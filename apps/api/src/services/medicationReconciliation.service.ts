import { PrismaClient, Medication, RecommendationType, RecommendationPriority } from '@prisma/client';
import { logger } from '../utils/logger';
import { smartMatchingService, MedicationMatch } from './smartMatching.service';
import { ParsedMedicalRecord } from './ai/openai.service';

const prisma = new PrismaClient();

export interface ReconciliationRecommendation {
  type: RecommendationType;
  title: string;
  description: string;
  priority: RecommendationPriority;
  linkedMedicationId: string | null;
  metadata: {
    reconciliationType: 'new' | 'dosage_change' | 'discontinued' | 'fuzzy_match';
    documentMedication?: {
      name: string;
      dosage?: string | null;
      frequency?: string | null;
    };
    existingMedication?: {
      id: string;
      name: string;
      dosage: string;
      frequency: string;
    };
    confidence?: number;
  };
}

export interface ReconciliationResult {
  recommendations: ReconciliationRecommendation[];
  stats: {
    totalDocumentMeds: number;
    exactMatches: number;
    newMedications: number;
    dosageChanges: number;
    fuzzyMatches: number;
    discontinuedMedications: number;
  };
}

export class MedicationReconciliationService {
  /**
   * Reconcile medications from a document against existing patient medications
   */
  async reconcile(params: {
    familyId: string;
    patientId: string;
    documentId: string;
    providerId: string | null;
    visitDate: string | null | undefined;
    documentMedications: ParsedMedicalRecord['medications'];
  }): Promise<ReconciliationResult> {
    try {
      logger.info(`Starting medication reconciliation for patient ${params.patientId}`);

      const recommendations: ReconciliationRecommendation[] = [];
      const stats = {
        totalDocumentMeds: params.documentMedications.length,
        exactMatches: 0,
        newMedications: 0,
        dosageChanges: 0,
        fuzzyMatches: 0,
        discontinuedMedications: 0,
      };

      // Get all active medications for this patient
      const existingMedications = await prisma.medication.findMany({
        where: {
          patientId: params.patientId,
          isActive: true,
        },
      });

      logger.debug(`Found ${existingMedications.length} existing medications`);

      // Track which existing medications were mentioned in the document
      const matchedExistingMedIds = new Set<string>();

      // Step 1: Process each medication from the document
      for (const docMed of params.documentMedications) {
        // Skip medications marked as "not currently taking" or similar
        if (
          docMed.status &&
          (docMed.status.toLowerCase().includes('not') ||
            docMed.status.toLowerCase().includes('discontinued') ||
            docMed.status.toLowerCase().includes('stopped'))
        ) {
          logger.debug(`Skipping discontinued medication: ${docMed.name}`);
          continue;
        }

        // Use smart matching to find if this medication exists
        const match = await smartMatchingService.matchMedication({
          medicationName: docMed.name,
          dosage: docMed.dosage,
          patientId: params.patientId,
        });

        if (match.matchType === 'exact') {
          // Exact match - no action needed
          stats.exactMatches++;
          if (match.matched) {
            matchedExistingMedIds.add(match.matched.id);
          }
          logger.debug(`Exact match for ${docMed.name}`);
        } else if (match.matchType === 'dosage_change' && match.matched) {
          // Dosage change detected
          stats.dosageChanges++;
          matchedExistingMedIds.add(match.matched.id);

          recommendations.push({
            type: 'MEDICATION',
            title: `Dosage change: ${match.matched.name}`,
            description: `Document shows ${docMed.name} ${docMed.dosage || ''} ${docMed.frequency || ''}, but your current medication list has ${match.matched.name} ${match.matched.dosage} ${match.matched.frequency}. Please verify this dosage change with your healthcare provider.`,
            priority: 'HIGH',
            linkedMedicationId: match.matched.id,
            metadata: {
              reconciliationType: 'dosage_change',
              documentMedication: {
                name: docMed.name,
                dosage: docMed.dosage,
                frequency: docMed.frequency,
              },
              existingMedication: {
                id: match.matched.id,
                name: match.matched.name,
                dosage: match.matched.dosage,
                frequency: match.matched.frequency,
              },
              confidence: match.confidence,
            },
          });

          logger.info(`Dosage change detected: ${match.matched.name}`);
        } else if (match.matchType === 'fuzzy' && match.matched && match.confidence >= 0.7) {
          // Fuzzy match - might be the same medication
          stats.fuzzyMatches++;
          matchedExistingMedIds.add(match.matched.id);

          recommendations.push({
            type: 'MEDICATION',
            title: `Verify medication: ${docMed.name}`,
            description: `Document lists "${docMed.name}" which appears similar to your existing medication "${match.matched.name}". Please confirm if these are the same medication (${Math.round(match.confidence * 100)}% confidence match).`,
            priority: 'MEDIUM',
            linkedMedicationId: match.matched.id,
            metadata: {
              reconciliationType: 'fuzzy_match',
              documentMedication: {
                name: docMed.name,
                dosage: docMed.dosage,
                frequency: docMed.frequency,
              },
              existingMedication: {
                id: match.matched.id,
                name: match.matched.name,
                dosage: match.matched.dosage,
                frequency: match.matched.frequency,
              },
              confidence: match.confidence,
            },
          });

          logger.info(`Fuzzy match for ${docMed.name} → ${match.matched.name}`);
        } else {
          // No match - this is a new medication
          stats.newMedications++;

          const priority = this.determinePriorityForNewMedication(docMed.name);

          recommendations.push({
            type: 'MEDICATION',
            title: `Add new medication: ${docMed.name}`,
            description: `Document lists ${docMed.name} ${docMed.dosage || ''} ${docMed.frequency || ''}, which is not in your current medication list. Consider adding this medication to track it properly.${docMed.notes ? ` Note: ${docMed.notes}` : ''}`,
            priority,
            linkedMedicationId: null,
            metadata: {
              reconciliationType: 'new',
              documentMedication: {
                name: docMed.name,
                dosage: docMed.dosage,
                frequency: docMed.frequency,
              },
            },
          });

          logger.info(`New medication detected: ${docMed.name}`);
        }
      }

      // Step 2: Check for discontinued medications
      // Any existing active medication not mentioned in the document
      for (const existingMed of existingMedications) {
        if (!matchedExistingMedIds.has(existingMed.id)) {
          stats.discontinuedMedications++;

          recommendations.push({
            type: 'MONITORING',
            title: `Medication not listed: ${existingMed.name}`,
            description: `${existingMed.name} ${existingMed.dosage} is in your medication list but was not mentioned in the recent visit document. Please confirm if you are still taking this medication.`,
            priority: 'MEDIUM',
            linkedMedicationId: existingMed.id,
            metadata: {
              reconciliationType: 'discontinued',
              existingMedication: {
                id: existingMed.id,
                name: existingMed.name,
                dosage: existingMed.dosage,
                frequency: existingMed.frequency,
              },
            },
          });

          logger.info(`Potentially discontinued medication: ${existingMed.name}`);
        }
      }

      logger.info(
        `Medication reconciliation complete: ${recommendations.length} recommendations generated`,
        stats
      );

      return {
        recommendations,
        stats,
      };
    } catch (error) {
      logger.error('Error during medication reconciliation:', error);
      return {
        recommendations: [],
        stats: {
          totalDocumentMeds: params.documentMedications.length,
          exactMatches: 0,
          newMedications: 0,
          dosageChanges: 0,
          fuzzyMatches: 0,
          discontinuedMedications: 0,
        },
      };
    }
  }

  /**
   * Determine priority for a new medication based on its name
   * Critical medications get higher priority
   */
  private determinePriorityForNewMedication(medicationName: string): RecommendationPriority {
    const name = medicationName.toLowerCase();

    // Critical medications (cardiovascular, diabetes, etc.)
    const criticalMeds = [
      'insulin',
      'warfarin',
      'coumadin',
      'digoxin',
      'nitroglycerin',
      'epinephrine',
      'prednisone',
    ];

    // High priority medications (blood pressure, cholesterol, etc.)
    const highPriorityMeds = [
      'lisinopril',
      'atorvastatin',
      'metformin',
      'levothyroxine',
      'amlodipine',
      'metoprolol',
      'losartan',
      'simvastatin',
    ];

    if (criticalMeds.some((med) => name.includes(med))) {
      return 'HIGH';
    }

    if (highPriorityMeds.some((med) => name.includes(med))) {
      return 'HIGH';
    }

    // Default to medium priority
    return 'MEDIUM';
  }
}

export const medicationReconciliationService = new MedicationReconciliationService();
