import { PrismaClient, Medication, PatientChecklistItem } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface MedicationMatch {
  matched: Medication | null;
  confidence: number; // 0-1
  matchType: 'exact' | 'fuzzy' | 'dosage_change' | 'none';
  explanation: string;
}

export interface ActivityMatch {
  matched: PatientChecklistItem | null;
  confidence: number;
  matchType: 'exact' | 'similar' | 'none';
  explanation: string;
}

export class SmartMatchingService {
  /**
   * Match a medication recommendation against existing medications
   * Handles brand/generic names, dosage changes, and fuzzy matching
   */
  async matchMedication(params: {
    medicationName: string;
    dosage?: string | null;
    patientId: string;
  }): Promise<MedicationMatch> {
    try {
      // Get all active medications for this patient
      const existingMedications = await prisma.medication.findMany({
        where: {
          patientId: params.patientId,
          isActive: true,
        },
      });

      if (existingMedications.length === 0) {
        return {
          matched: null,
          confidence: 0,
          matchType: 'none',
          explanation: 'No existing medications to match against',
        };
      }

      // Normalize the input medication name
      const normalizedInput = this.normalizeMedicationName(params.medicationName);
      const inputDosage = params.dosage ? this.normalizeDosage(params.dosage) : null;

      let bestMatch: Medication | null = null;
      let bestScore = 0;
      let matchType: 'exact' | 'fuzzy' | 'dosage_change' | 'none' = 'none';

      for (const med of existingMedications) {
        const normalizedExisting = this.normalizeMedicationName(med.name);
        const existingDosage = this.normalizeDosage(med.dosage);

        // Check for exact name match
        if (normalizedInput === normalizedExisting) {
          // Same medication name
          if (inputDosage && existingDosage && inputDosage !== existingDosage) {
            // Dosage change detected
            if (bestScore < 0.95) {
              bestMatch = med;
              bestScore = 0.95;
              matchType = 'dosage_change';
            }
          } else {
            // Exact match (same name, same or no dosage)
            return {
              matched: med,
              confidence: 1.0,
              matchType: 'exact',
              explanation: `Exact match: You're already taking ${med.name} ${med.dosage}`,
            };
          }
        } else {
          // Check for fuzzy match
          const similarity = this.calculateStringSimilarity(normalizedInput, normalizedExisting);

          // Also check if one might be brand name of the other
          const isBrandMatch = this.checkBrandNameMatch(params.medicationName, med.name);

          const score = isBrandMatch ? Math.max(similarity, 0.85) : similarity;

          if (score > bestScore && score >= 0.7) {
            bestMatch = med;
            bestScore = score;
            matchType = 'fuzzy';
          }
        }
      }

      if (bestMatch) {
        let explanation = '';
        if (matchType === 'dosage_change') {
          explanation = `This looks like a dosage change from ${bestMatch.name} ${bestMatch.dosage} to ${params.dosage}`;
        } else if (matchType === 'fuzzy') {
          explanation = `This might be the same as ${bestMatch.name} (${Math.round(bestScore * 100)}% similar)`;
        }

        return {
          matched: bestMatch,
          confidence: bestScore,
          matchType,
          explanation,
        };
      }

      return {
        matched: null,
        confidence: 0,
        matchType: 'none',
        explanation: 'No similar medications found',
      };
    } catch (error) {
      logger.error('Error matching medication:', error);
      return {
        matched: null,
        confidence: 0,
        matchType: 'none',
        explanation: 'Error during matching',
      };
    }
  }

  /**
   * Match an activity/exercise recommendation against existing checklist items
   */
  async matchActivity(params: {
    activityDescription: string;
    patientId: string;
  }): Promise<ActivityMatch> {
    try {
      // Get all active exercise checklist items
      const existingActivities = await prisma.patientChecklistItem.findMany({
        where: {
          patientId: params.patientId,
          category: 'EXERCISE',
          isActive: true,
        },
      });

      if (existingActivities.length === 0) {
        return {
          matched: null,
          confidence: 0,
          matchType: 'none',
          explanation: 'No existing exercise activities to match against',
        };
      }

      const normalizedInput = params.activityDescription.toLowerCase().trim();

      let bestMatch: PatientChecklistItem | null = null;
      let bestScore = 0;

      for (const activity of existingActivities) {
        const normalizedTitle = activity.title.toLowerCase().trim();
        const normalizedDesc = activity.description?.toLowerCase().trim() || '';

        // Check title similarity
        const titleSimilarity = this.calculateStringSimilarity(normalizedInput, normalizedTitle);

        // Check description similarity
        const descSimilarity = normalizedDesc
          ? this.calculateStringSimilarity(normalizedInput, normalizedDesc)
          : 0;

        // Also check if input contains title or vice versa
        const containsMatch =
          normalizedInput.includes(normalizedTitle) || normalizedTitle.includes(normalizedInput)
            ? 0.8
            : 0;

        const score = Math.max(titleSimilarity, descSimilarity, containsMatch);

        if (score > bestScore && score >= 0.6) {
          bestMatch = activity;
          bestScore = score;
        }
      }

      if (bestMatch) {
        const matchType = bestScore >= 0.85 ? 'exact' : 'similar';
        const explanation =
          matchType === 'exact'
            ? `This matches your existing activity: ${bestMatch.title}`
            : `This is similar to your existing activity: ${bestMatch.title} (${Math.round(bestScore * 100)}% match)`;

        return {
          matched: bestMatch,
          confidence: bestScore,
          matchType,
          explanation,
        };
      }

      return {
        matched: null,
        confidence: 0,
        matchType: 'none',
        explanation: 'No similar activities found',
      };
    } catch (error) {
      logger.error('Error matching activity:', error);
      return {
        matched: null,
        confidence: 0,
        matchType: 'none',
        explanation: 'Error during matching',
      };
    }
  }

  /**
   * Normalize medication name for comparison
   * Removes common suffixes, converts to lowercase, removes extra spaces
   */
  private normalizeMedicationName(name: string): string {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/\b(tablet|capsule|pill|mg|mcg|ml|extended release|er|xr|sr)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalize dosage string for comparison
   */
  private normalizeDosage(dosage: string): string {
    return dosage
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/milligram[s]?/g, 'mg')
      .replace(/microgram[s]?/g, 'mcg')
      .replace(/milliliter[s]?/g, 'ml');
  }

  /**
   * Calculate string similarity using Levenshtein distance
   * Returns a score between 0 (completely different) and 1 (identical)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Check if two medication names might be brand/generic equivalents
   * This is a simple heuristic - in production you'd use a drug database
   */
  private checkBrandNameMatch(name1: string, name2: string): boolean {
    // Common brand/generic pairs (expand this list as needed)
    const knownPairs = [
      ['lisinopril', 'zestril', 'prinivil'],
      ['atorvastatin', 'lipitor'],
      ['metformin', 'glucophage'],
      ['omeprazole', 'prilosec'],
      ['amlodipine', 'norvasc'],
      ['simvastatin', 'zocor'],
      ['levothyroxine', 'synthroid'],
      ['azithromycin', 'zithromax'],
      ['amoxicillin', 'amoxil'],
      ['furosemide', 'lasix'],
      ['metoprolol', 'lopressor', 'toprol'],
      ['hydrochlorothiazide', 'microzide'],
      ['losartan', 'cozaar'],
      ['gabapentin', 'neurontin'],
      ['sertraline', 'zoloft'],
    ];

    const n1 = name1.toLowerCase();
    const n2 = name2.toLowerCase();

    for (const group of knownPairs) {
      if (group.some((med) => n1.includes(med)) && group.some((med) => n2.includes(med))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Batch match multiple medications
   */
  async batchMatchMedications(params: {
    medications: Array<{ name: string; dosage?: string | null }>;
    patientId: string;
  }): Promise<MedicationMatch[]> {
    const results: MedicationMatch[] = [];

    for (const med of params.medications) {
      const match = await this.matchMedication({
        medicationName: med.name,
        dosage: med.dosage,
        patientId: params.patientId,
      });
      results.push(match);
    }

    return results;
  }
}

export const smartMatchingService = new SmartMatchingService();
