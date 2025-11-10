import {
  PrismaClient,
  RecommendationType,
  RecommendationStatus,
  RecommendationPriority,
} from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

interface ParsedRecommendation {
  text: string;
  type?: string | null;
  priority?: string | null;
  frequency?: string | null;
  duration?: string | null;
}

export class RecommendationService {
  /**
   * Create recommendations from parsed document data
   */
  async createRecommendationsFromParsedData(params: {
    familyId: string;
    patientId: string;
    documentId: string;
    providerId: string | null;
    visitDate: string | null | undefined;
    recommendations: ParsedRecommendation[];
  }): Promise<string[]> {
    if (!params.recommendations || params.recommendations.length === 0) {
      logger.debug('No recommendations found in parsed data');
      return [];
    }

    const createdIds: string[] = [];

    for (const rec of params.recommendations) {
      try {
        const recommendationId = await this.createRecommendation({
          familyId: params.familyId,
          patientId: params.patientId,
          documentId: params.documentId,
          providerId: params.providerId,
          visitDate: params.visitDate,
          parsedRecommendation: rec,
        });

        if (recommendationId) {
          createdIds.push(recommendationId);
        }
      } catch (error) {
        logger.error(`Error creating recommendation: ${rec.text}`, error);
        // Continue with other recommendations
      }
    }

    logger.info(
      `Created ${createdIds.length} recommendations from document ${params.documentId}`
    );
    return createdIds;
  }

  /**
   * Create a single recommendation
   */
  private async createRecommendation(params: {
    familyId: string;
    patientId: string;
    documentId: string;
    providerId: string | null;
    visitDate: string | null | undefined;
    parsedRecommendation: ParsedRecommendation;
  }): Promise<string | null> {
    const rec = params.parsedRecommendation;

    // Parse type, priority from strings
    const type = this.parseRecommendationType(rec.type);
    const priority = this.parseRecommendationPriority(rec.priority);

    // Parse visit date
    const visitDate = params.visitDate ? this.parseDate(params.visitDate) : null;

    // Generate title from recommendation text (first 60 chars)
    const title = rec.text.length > 60
      ? rec.text.substring(0, 57) + '...'
      : rec.text;

    const recommendation = await prisma.recommendation.create({
      data: {
        familyId: params.familyId,
        patientId: params.patientId,
        documentId: params.documentId,
        providerId: params.providerId,
        visitDate,
        type,
        title,
        description: rec.text,
        priority,
        frequency: rec.frequency,
        duration: rec.duration,
        status: 'PENDING',
      },
    });

    return recommendation.id;
  }

  /**
   * Get all recommendations for a family
   */
  async getRecommendationsByFamily(
    familyId: string,
    status?: RecommendationStatus
  ) {
    return prisma.recommendation.findMany({
      where: {
        familyId,
        ...(status && { status }),
      },
      include: {
        provider: true,
        document: true,
        linkedMedication: true,
        linkedCareTask: true,
        linkedChecklistItem: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get recommendations by document
   */
  async getRecommendationsByDocument(documentId: string) {
    return prisma.recommendation.findMany({
      where: {
        documentId,
      },
      include: {
        provider: true,
      },
      orderBy: {
        priority: 'desc',
      },
    });
  }

  /**
   * Update recommendation status
   */
  async updateRecommendationStatus(
    recommendationId: string,
    status: RecommendationStatus,
    userId: string
  ) {
    return prisma.recommendation.update({
      where: { id: recommendationId },
      data: {
        status,
        ...(status === 'ACKNOWLEDGED' && {
          acknowledgedBy: userId,
          acknowledgedAt: new Date(),
        }),
        ...(status === 'IN_PROGRESS' && {
          implementedAt: new Date(),
        }),
      },
    });
  }

  /**
   * Dismiss a recommendation
   */
  async dismissRecommendation(
    recommendationId: string,
    userId: string,
    reason?: string
  ) {
    return prisma.recommendation.update({
      where: { id: recommendationId },
      data: {
        status: 'DISMISSED',
        dismissedReason: reason,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      },
    });
  }

  /**
   * Parse recommendation type from string
   */
  private parseRecommendationType(
    typeString: string | null | undefined
  ): RecommendationType {
    if (!typeString) return 'LIFESTYLE'; // Default

    const lower = typeString.toLowerCase();

    if (lower.includes('medic') || lower.includes('drug') || lower.includes('prescri')) {
      return 'MEDICATION';
    }
    if (lower.includes('exercis') || lower.includes('physical activity') || lower.includes('walk')) {
      return 'EXERCISE';
    }
    if (lower.includes('diet') || lower.includes('nutrition') || lower.includes('food')) {
      return 'DIET';
    }
    if (lower.includes('therap') || lower.includes('pt') || lower.includes('ot')) {
      return 'THERAPY';
    }
    if (lower.includes('monitor') || lower.includes('track') || lower.includes('measure')) {
      return 'MONITORING';
    }
    if (lower.includes('follow') || lower.includes('appointment') || lower.includes('visit')) {
      return 'FOLLOWUP';
    }
    if (lower.includes('test') || lower.includes('lab') || lower.includes('imaging') || lower.includes('xray') || lower.includes('mri')) {
      return 'TESTS';
    }

    return 'LIFESTYLE';
  }

  /**
   * Parse recommendation priority from string
   */
  private parseRecommendationPriority(
    priorityString: string | null | undefined
  ): RecommendationPriority {
    if (!priorityString) return 'MEDIUM'; // Default

    const lower = priorityString.toLowerCase();

    if (lower.includes('urgent') || lower.includes('critical') || lower.includes('immediate')) {
      return 'URGENT';
    }
    if (lower.includes('high') || lower.includes('important')) {
      return 'HIGH';
    }
    if (lower.includes('low')) {
      return 'LOW';
    }

    return 'MEDIUM';
  }

  /**
   * Parse date string to Date object
   */
  private parseDate(dateString: string): Date {
    // Try ISO format first (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
      return new Date(dateString);
    }

    // Try MM/DD/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateString)) {
      return new Date(dateString);
    }

    // Try parsing as-is
    const parsed = new Date(dateString);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    // Fallback to current date
    return new Date();
  }
}

export const recommendationService = new RecommendationService();
