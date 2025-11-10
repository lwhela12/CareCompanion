import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { ParsedMedicalRecord } from './ai/openai.service';
import { providerAutoPopulationService } from './providerAutoPopulation.service';
import { journalAutoPopulationService } from './journalAutoPopulation.service';
import { recommendationService } from './recommendation.service';
import { smartMatchingService, MedicationMatch, ActivityMatch } from './smartMatching.service';

const prisma = new PrismaClient();

interface MatchedRecommendation {
  recommendationId: string;
  type: string;
  title: string;
  medicationMatch?: MedicationMatch;
  activityMatch?: ActivityMatch;
}

interface ProcessingResult {
  providerId: string | null;
  providerCreated: boolean;
  journalEntryId: string | null;
  recommendationIds: string[];
  matchedRecommendations: MatchedRecommendation[];
  summary: string;
}

export class DocumentProcessingService {
  /**
   * Process parsed document data to auto-populate app entities
   * This is called after successful document parsing
   */
  async processAfterParsing(params: {
    documentId: string;
    familyId: string;
    userId: string;
    parsedData: ParsedMedicalRecord;
  }): Promise<ProcessingResult> {
    logger.info(`Processing parsed document ${params.documentId} for family ${params.familyId}`);

    const result: ProcessingResult = {
      providerId: null,
      providerCreated: false,
      journalEntryId: null,
      recommendationIds: [],
      matchedRecommendations: [],
      summary: '',
    };

    try {
      // Get patient ID for this family
      const family = await prisma.family.findUnique({
        where: { id: params.familyId },
        include: { patient: true },
      });

      if (!family?.patient) {
        logger.warn(`No patient found for family ${params.familyId}`);
        result.summary = 'Document parsed but no patient found for auto-population';
        return result;
      }

      const patientId = family.patient.id;

      // Step 1: Auto-create/update Provider
      if (params.parsedData.visit?.provider?.name) {
        const existingProvidersCount = await prisma.provider.count({
          where: { familyId: params.familyId },
        });

        result.providerId = await providerAutoPopulationService.upsertProviderFromParsedData(
          params.familyId,
          params.parsedData.visit.facility,
          params.parsedData.visit.provider
        );

        if (result.providerId) {
          const newProvidersCount = await prisma.provider.count({
            where: { familyId: params.familyId },
          });
          result.providerCreated = newProvidersCount > existingProvidersCount;
        }
      }

      // Step 2: Auto-create Journal Entry from visit summary
      if (params.parsedData.visit?.summary) {
        result.journalEntryId = await journalAutoPopulationService.createJournalFromVisit({
          familyId: params.familyId,
          userId: params.userId,
          documentId: params.documentId,
          visitSummary: params.parsedData.visit.summary,
          visitDate: params.parsedData.visit.dateOfService,
          providerId: result.providerId,
          providerName: params.parsedData.visit.provider?.name,
        });
      }

      // Step 3: Create Recommendations
      if (params.parsedData.recommendations && params.parsedData.recommendations.length > 0) {
        result.recommendationIds = await recommendationService.createRecommendationsFromParsedData({
          familyId: params.familyId,
          patientId,
          documentId: params.documentId,
          providerId: result.providerId,
          visitDate: params.parsedData.visit?.dateOfService,
          recommendations: params.parsedData.recommendations,
        });

        // Step 4: Run smart matching on recommendations
        result.matchedRecommendations = await this.runSmartMatching({
          recommendationIds: result.recommendationIds,
          patientId,
          parsedRecommendations: params.parsedData.recommendations,
        });
      }

      // Build summary message
      result.summary = this.buildSummaryMessage(result);

      logger.info(`Document processing complete: ${result.summary}`);
      return result;
    } catch (error) {
      logger.error('Error processing document data:', error);
      result.summary = 'Document parsed successfully but auto-population encountered errors';
      return result;
    }
  }

  /**
   * Run smart matching on created recommendations
   */
  private async runSmartMatching(params: {
    recommendationIds: string[];
    patientId: string;
    parsedRecommendations: any[];
  }): Promise<MatchedRecommendation[]> {
    const matchedRecommendations: MatchedRecommendation[] = [];

    // Get the created recommendations with their types
    const recommendations = await prisma.recommendation.findMany({
      where: {
        id: { in: params.recommendationIds },
      },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
      },
    });

    for (const rec of recommendations) {
      const matched: MatchedRecommendation = {
        recommendationId: rec.id,
        type: rec.type,
        title: rec.title,
      };

      try {
        // Match medication recommendations
        if (rec.type === 'MEDICATION') {
          // Extract medication name from description
          // This is a simple approach - could be enhanced with better parsing
          const parsedRec = params.parsedRecommendations.find((pr) =>
            pr.text === rec.description || rec.description.includes(pr.text)
          );

          if (parsedRec) {
            // Try to extract medication name and dosage from the recommendation text
            const medicationMatch = await smartMatchingService.matchMedication({
              medicationName: this.extractMedicationName(rec.description),
              dosage: this.extractDosage(rec.description),
              patientId: params.patientId,
            });

            if (medicationMatch.matchType !== 'none') {
              matched.medicationMatch = medicationMatch;
              logger.info(`Medication match found: ${medicationMatch.explanation}`);
            }
          }
        }

        // Match exercise recommendations
        if (rec.type === 'EXERCISE') {
          const activityMatch = await smartMatchingService.matchActivity({
            activityDescription: rec.description,
            patientId: params.patientId,
          });

          if (activityMatch.matchType !== 'none') {
            matched.activityMatch = activityMatch;
            logger.info(`Activity match found: ${activityMatch.explanation}`);
          }
        }

        matchedRecommendations.push(matched);
      } catch (error) {
        logger.error(`Error matching recommendation ${rec.id}:`, error);
        // Still add the recommendation without match info
        matchedRecommendations.push(matched);
      }
    }

    return matchedRecommendations;
  }

  /**
   * Extract medication name from recommendation text
   * Simple heuristic - can be improved
   */
  private extractMedicationName(text: string): string {
    // Common patterns: "Start X", "Increase X", "Continue X", "X 10mg"
    const patterns = [
      /(?:start|begin|initiate|take|continue|increase|decrease)\s+([a-z]+)/i,
      /^([a-z]+)\s+\d+\s*(?:mg|mcg|ml)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    // Fallback: take first word
    const words = text.split(/\s+/);
    return words[0] || text;
  }

  /**
   * Extract dosage from recommendation text
   */
  private extractDosage(text: string): string | null {
    const dosagePattern = /(\d+\s*(?:mg|mcg|ml|g))/i;
    const match = text.match(dosagePattern);
    return match ? match[1] : null;
  }

  /**
   * Build a human-readable summary of what was created
   */
  private buildSummaryMessage(result: ProcessingResult): string {
    const parts: string[] = [];

    if (result.providerId) {
      if (result.providerCreated) {
        parts.push('Added provider to contacts');
      } else {
        parts.push('Updated provider information');
      }
    }

    if (result.journalEntryId) {
      parts.push('Created journal entry from visit');
    }

    if (result.recommendationIds.length > 0) {
      parts.push(`Found ${result.recommendationIds.length} recommendation${result.recommendationIds.length === 1 ? '' : 's'}`);

      // Add match information
      const matches = result.matchedRecommendations.filter(
        (m) => m.medicationMatch?.matchType !== 'none' || m.activityMatch?.matchType !== 'none'
      );

      if (matches.length > 0) {
        parts.push(`(${matches.length} matched existing items)`);
      }
    }

    if (parts.length === 0) {
      return 'Document parsed successfully';
    }

    return parts.join(', ');
  }

  /**
   * Get processing summary for a document
   * Shows what was auto-created from this document
   */
  async getDocumentProcessingSummary(documentId: string) {
    const [journalEntries, recommendations] = await Promise.all([
      prisma.journalEntry.findMany({
        where: { sourceDocumentId: documentId },
        select: {
          id: true,
          content: true,
          createdAt: true,
          sentiment: true,
        },
      }),
      prisma.recommendation.findMany({
        where: { documentId },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          priority: true,
        },
      }),
    ]);

    return {
      journalEntries,
      recommendations,
      totalItems: journalEntries.length + recommendations.length,
    };
  }
}

export const documentProcessingService = new DocumentProcessingService();
