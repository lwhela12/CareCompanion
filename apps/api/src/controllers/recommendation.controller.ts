import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma, RecommendationStatus, RecommendationType, RecommendationPriority } from '@carecompanion/database';
import { ApiError } from '../middleware/error';
import { ErrorCodes } from '@carecompanion/shared';
import { AuthRequest } from '../types';
import { recommendationService } from '../services/recommendation.service';
import { logger } from '../utils/logger';

// Validation schemas
const updateRecommendationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  frequency: z.string().max(100).optional(),
  duration: z.string().max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const dismissRecommendationSchema = z.object({
  reason: z.string().max(500).optional(),
});

const acceptRecommendationSchema = z.object({
  // For MEDICATION type
  medicationData: z.object({
    dosage: z.string().min(1).max(50),
    frequency: z.string().min(1).max(50),
    scheduleTimes: z.array(z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)),
    instructions: z.string().max(500).optional(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime().optional(),
    currentSupply: z.number().int().positive().optional(),
    refillThreshold: z.number().int().positive().default(7),
  }).optional(),
  // For EXERCISE/DIET/LIFESTYLE type (checklist item)
  checklistData: z.object({
    category: z.enum(['MEDICATION', 'EXERCISE', 'MEALS', 'HYGIENE', 'SOCIAL', 'THERAPY', 'OTHER']),
    scheduledTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  }).optional(),
  // For FOLLOWUP/TESTS type (care task)
  careTaskData: z.object({
    dueDate: z.string().datetime().optional(),
    reminderDate: z.string().datetime().optional(),
    assignedToId: z.string().uuid().optional(),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
    recurrenceRule: z.string().optional(), // e.g., "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR"
    recurrenceEndDate: z.string().datetime().optional(),
    isRecurrenceTemplate: z.boolean().default(false),
  }).optional(),
});

const bulkAcceptSchema = z.object({
  recommendationIds: z.array(z.string().uuid()).min(1).max(50),
  acceptanceData: z.record(z.string().uuid(), acceptRecommendationSchema),
});

export class RecommendationController {
  /**
   * Get all recommendations for family
   * Query params: status, type, priority
   */
  async getRecommendations(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { status, type, priority } = req.query;

    // Get user's family
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: { family: true },
        },
      },
    });

    if (!user || user.familyMembers.length === 0) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'No family found', 404);
    }

    const familyId = user.familyMembers[0].family.id;

    // Build filter
    const where: any = { familyId };

    if (status && typeof status === 'string') {
      where.status = status as RecommendationStatus;
    }
    if (type && typeof type === 'string') {
      where.type = type as RecommendationType;
    }
    if (priority && typeof priority === 'string') {
      where.priority = priority as RecommendationPriority;
    }

    const recommendations = await prisma.recommendation.findMany({
      where,
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            specialty: true,
          },
        },
        document: {
          select: {
            id: true,
            title: true,
            createdAt: true,
          },
        },
        linkedMedication: {
          select: {
            id: true,
            name: true,
            dosage: true,
            isActive: true,
          },
        },
        linkedCareTask: {
          select: {
            id: true,
            title: true,
            status: true,
            dueDate: true,
          },
        },
        linkedChecklistItem: {
          select: {
            id: true,
            title: true,
            category: true,
            isActive: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { visitDate: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({ recommendations });
  }

  /**
   * Get single recommendation by ID
   */
  async getRecommendation(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { id } = req.params;

    // Get user's family
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: { family: true },
        },
      },
    });

    if (!user || user.familyMembers.length === 0) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'No family found', 404);
    }

    const familyId = user.familyMembers[0].family.id;

    const recommendation = await prisma.recommendation.findFirst({
      where: {
        id,
        familyId,
      },
      include: {
        provider: true,
        document: true,
        linkedMedication: true,
        linkedCareTask: true,
        linkedChecklistItem: true,
      },
    });

    if (!recommendation) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Recommendation not found', 404);
    }

    res.json({ recommendation });
  }

  /**
   * Update recommendation
   */
  async updateRecommendation(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { id } = req.params;

    const validatedData = updateRecommendationSchema.parse(req.body);

    // Get user's family and verify access
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: { family: true },
        },
      },
    });

    if (!user || user.familyMembers.length === 0) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'No family found', 404);
    }

    const familyId = user.familyMembers[0].family.id;

    // Verify recommendation belongs to family
    const existing = await prisma.recommendation.findFirst({
      where: { id, familyId },
    });

    if (!existing) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Recommendation not found', 404);
    }

    // Update recommendation
    const updated = await prisma.recommendation.update({
      where: { id },
      data: {
        ...validatedData,
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : undefined,
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : undefined,
      },
      include: {
        provider: true,
        document: true,
        linkedMedication: true,
        linkedCareTask: true,
        linkedChecklistItem: true,
      },
    });

    res.json({ recommendation: updated });
  }

  /**
   * Acknowledge recommendation (mark as reviewed)
   */
  async acknowledgeRecommendation(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { id } = req.params;

    // Get user's family and user record
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: { family: true },
        },
      },
    });

    if (!user || user.familyMembers.length === 0) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'No family found', 404);
    }

    const familyId = user.familyMembers[0].family.id;

    // Verify recommendation belongs to family
    const existing = await prisma.recommendation.findFirst({
      where: { id, familyId },
    });

    if (!existing) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Recommendation not found', 404);
    }

    const updated = await recommendationService.updateRecommendationStatus(
      id,
      'ACKNOWLEDGED',
      user.id
    );

    res.json({ recommendation: updated });
  }

  /**
   * Accept recommendation (create linked entity)
   */
  async acceptRecommendation(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { id } = req.params;

    const validatedData = acceptRecommendationSchema.parse(req.body);

    // Get user's family and patient
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: {
            family: {
              include: { patient: true },
            },
          },
        },
      },
    });

    if (!user || user.familyMembers.length === 0) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'No family found', 404);
    }

    const family = user.familyMembers[0].family;
    const familyId = family.id;
    const patientId = family.patient?.id;

    if (!patientId) {
      throw new ApiError(ErrorCodes.BAD_REQUEST, 'No patient found for family', 400);
    }

    // Get recommendation
    const recommendation = await prisma.recommendation.findFirst({
      where: { id, familyId },
      include: { provider: true },
    });

    if (!recommendation) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Recommendation not found', 404);
    }

    // Create linked entity based on recommendation type
    let linkedEntityId: string | null = null;
    let linkedEntityType: 'medication' | 'careTask' | 'checklistItem' | null = null;

    try {
      switch (recommendation.type) {
        case 'MEDICATION':
          if (!validatedData.medicationData) {
            throw new ApiError(
              ErrorCodes.BAD_REQUEST,
              'Medication data required for MEDICATION type recommendations',
              400
            );
          }

          const medication = await prisma.medication.create({
            data: {
              patientId,
              name: recommendation.title,
              dosage: validatedData.medicationData.dosage,
              frequency: validatedData.medicationData.frequency,
              scheduleTime: validatedData.medicationData.scheduleTimes,
              instructions: validatedData.medicationData.instructions,
              prescribedBy: recommendation.provider?.name || undefined,
              prescribingProviderId: recommendation.providerId || undefined,
              startDate: new Date(validatedData.medicationData.startDate),
              endDate: validatedData.medicationData.endDate
                ? new Date(validatedData.medicationData.endDate)
                : undefined,
              currentSupply: validatedData.medicationData.currentSupply,
              refillThreshold: validatedData.medicationData.refillThreshold,
              createdById: user.id,
              isActive: true,
            },
          });

          linkedEntityId = medication.id;
          linkedEntityType = 'medication';
          break;

        case 'EXERCISE':
        case 'DIET':
        case 'LIFESTYLE':
        case 'THERAPY':
          if (!validatedData.checklistData) {
            throw new ApiError(
              ErrorCodes.BAD_REQUEST,
              'Checklist data required for this recommendation type',
              400
            );
          }

          const checklistItem = await prisma.patientChecklistItem.create({
            data: {
              patientId,
              title: recommendation.title,
              description: recommendation.description,
              category: validatedData.checklistData.category,
              scheduledTime: validatedData.checklistData.scheduledTime,
              isActive: true,
              createdById: user.id,
            },
          });

          linkedEntityId = checklistItem.id;
          linkedEntityType = 'checklistItem';
          break;

        case 'FOLLOWUP':
        case 'TESTS':
        case 'MONITORING':
          if (!validatedData.careTaskData) {
            throw new ApiError(
              ErrorCodes.BAD_REQUEST,
              'Care task data required for this recommendation type',
              400
            );
          }

          const careTask = await prisma.careTask.create({
            data: {
              familyId,
              title: recommendation.title,
              description: recommendation.description,
              status: 'PENDING',
              priority: validatedData.careTaskData.priority ||
                (recommendation.priority === 'URGENT' || recommendation.priority === 'HIGH'
                  ? 'HIGH'
                  : recommendation.priority === 'LOW'
                  ? 'LOW'
                  : 'MEDIUM'),
              dueDate: validatedData.careTaskData.dueDate
                ? new Date(validatedData.careTaskData.dueDate)
                : undefined,
              reminderDate: validatedData.careTaskData.reminderDate
                ? new Date(validatedData.careTaskData.reminderDate)
                : undefined,
              assignedToId: validatedData.careTaskData.assignedToId,
              recurrenceRule: validatedData.careTaskData.recurrenceRule,
              recurrenceEndDate: validatedData.careTaskData.recurrenceEndDate
                ? new Date(validatedData.careTaskData.recurrenceEndDate)
                : undefined,
              isRecurrenceTemplate: validatedData.careTaskData.isRecurrenceTemplate,
              createdById: user.id,
            },
          });

          linkedEntityId = careTask.id;
          linkedEntityType = 'careTask';
          break;

        default:
          throw new ApiError(
            ErrorCodes.BAD_REQUEST,
            `Unsupported recommendation type: ${recommendation.type}`,
            400
          );
      }

      // Update recommendation with linked entity
      const updated = await prisma.recommendation.update({
        where: { id },
        data: {
          status: 'IN_PROGRESS',
          implementedAt: new Date(),
          linkedMedicationId: linkedEntityType === 'medication' ? linkedEntityId : null,
          linkedCareTaskId: linkedEntityType === 'careTask' ? linkedEntityId : null,
          linkedChecklistItemId: linkedEntityType === 'checklistItem' ? linkedEntityId : null,
          acknowledgedBy: user.id,
          acknowledgedAt: new Date(),
        },
        include: {
          provider: true,
          document: true,
          linkedMedication: true,
          linkedCareTask: true,
          linkedChecklistItem: true,
        },
      });

      logger.info(`Recommendation ${id} accepted and ${linkedEntityType} created: ${linkedEntityId}`);

      res.json({
        recommendation: updated,
        linkedEntity: {
          id: linkedEntityId,
          type: linkedEntityType,
        },
      });
    } catch (error) {
      // If entity creation fails, don't update recommendation
      logger.error('Error accepting recommendation:', error);
      throw error;
    }
  }

  /**
   * Dismiss recommendation
   */
  async dismissRecommendation(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { id } = req.params;

    const validatedData = dismissRecommendationSchema.parse(req.body);

    // Get user's family and user record
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: { family: true },
        },
      },
    });

    if (!user || user.familyMembers.length === 0) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'No family found', 404);
    }

    const familyId = user.familyMembers[0].family.id;

    // Verify recommendation belongs to family
    const existing = await prisma.recommendation.findFirst({
      where: { id, familyId },
    });

    if (!existing) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Recommendation not found', 404);
    }

    const updated = await recommendationService.dismissRecommendation(
      id,
      user.id,
      validatedData.reason
    );

    res.json({ recommendation: updated });
  }

  /**
   * Bulk accept recommendations
   */
  async bulkAcceptRecommendations(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;

    const validatedData = bulkAcceptSchema.parse(req.body);

    // Get user's family
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: {
            family: {
              include: { patient: true },
            },
          },
        },
      },
    });

    if (!user || user.familyMembers.length === 0) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'No family found', 404);
    }

    const family = user.familyMembers[0].family;
    const familyId = family.id;

    // Verify all recommendations belong to family
    const recommendations = await prisma.recommendation.findMany({
      where: {
        id: { in: validatedData.recommendationIds },
        familyId,
      },
    });

    if (recommendations.length !== validatedData.recommendationIds.length) {
      throw new ApiError(
        ErrorCodes.BAD_REQUEST,
        'Some recommendations not found or do not belong to your family',
        400
      );
    }

    const results = {
      successful: [] as string[],
      failed: [] as Array<{ id: string; error: string }>,
    };

    // Process each recommendation
    for (const recId of validatedData.recommendationIds) {
      try {
        // Create a mock request for acceptRecommendation
        const mockReq = {
          auth: req.auth,
          params: { id: recId },
          body: validatedData.acceptanceData[recId] || {},
        } as any;

        const mockRes = {
          json: () => {},
        } as any;

        await this.acceptRecommendation(mockReq, mockRes);
        results.successful.push(recId);
      } catch (error: any) {
        logger.error(`Failed to accept recommendation ${recId}:`, error);
        results.failed.push({
          id: recId,
          error: error.message || 'Unknown error',
        });
      }
    }

    res.json({
      message: `Bulk accept completed: ${results.successful.length} successful, ${results.failed.length} failed`,
      results,
    });
  }
}

export const recommendationController = new RecommendationController();
