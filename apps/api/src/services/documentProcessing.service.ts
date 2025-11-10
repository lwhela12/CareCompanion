import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { ParsedMedicalRecord } from './ai/openai.service';
import { providerAutoPopulationService } from './providerAutoPopulation.service';
import { journalAutoPopulationService } from './journalAutoPopulation.service';
import { recommendationService } from './recommendation.service';

const prisma = new PrismaClient();

interface ProcessingResult {
  providerId: string | null;
  providerCreated: boolean;
  journalEntryId: string | null;
  recommendationIds: string[];
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
