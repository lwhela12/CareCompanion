import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma, MealType } from '@carecompanion/database';
import { ApiError } from '../middleware/error';
import { ErrorCodes } from '@carecompanion/shared';
import { AuthRequest } from '../types';
import { nutritionService } from '../services/nutrition.service';
import { mealAnalysisService } from '../services/ai/mealAnalysis.service';
import { s3Service } from '../services/s3.service';
import { logger } from '../utils/logger';

// Validation schemas
const createMealLogSchema = z.object({
  patientId: z.string().uuid(),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'OTHER']),
  consumedAt: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
  photoUrls: z.array(z.string().url()).max(5).default([]),
  voiceNoteUrl: z.string().url().optional(),
  templateId: z.string().uuid().optional(),
  analyzeWithAI: z.boolean().default(true),
});

const updateMealLogSchema = z.object({
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'OTHER']).optional(),
  consumedAt: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
  photoUrls: z.array(z.string().url()).max(5).optional(),
  voiceNoteUrl: z.string().url().optional(),
});

const createMealTemplateSchema = z.object({
  patientId: z.string().uuid(),
  name: z.string().min(1).max(100),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'OTHER']),
  nutritionData: z.object({
    estimatedCalories: z.number().optional(),
    proteinGrams: z.number().optional(),
    carbsGrams: z.number().optional(),
    fatGrams: z.number().optional(),
    sodiumMg: z.number().optional(),
    foodItems: z.array(z.string()),
  }),
  photoUrl: z.string().url().optional(),
});

const updateMealTemplateSchema = createMealTemplateSchema.partial().omit({ patientId: true });

const createNutritionRecommendationSchema = z.object({
  recommendationId: z.string().uuid(),
  dailyCalories: z.number().int().positive().optional(),
  proteinGrams: z.number().positive().optional(),
  carbsGrams: z.number().positive().optional(),
  fatGrams: z.number().positive().optional(),
  sodiumMg: z.number().positive().optional(),
  restrictions: z.array(z.string()).default([]),
  goals: z.array(z.string()).default([]),
  specialInstructions: z.string().max(1000).optional(),
  recommendedMealTimes: z.array(z.string()).default([]),
});

const uploadUrlSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().min(1),
});

export class NutritionController {
  /**
   * Get meal logs for a patient
   * GET /patients/:patientId/meals
   */
  async getMealLogs(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { patientId } = req.params;
    const { startDate, endDate, mealType, limit, offset } = req.query;

    // Verify user has access to this patient
    await this.verifyPatientAccess(userId, patientId);

    const filters: any = {};

    if (startDate && typeof startDate === 'string') {
      filters.startDate = new Date(startDate);
    }
    if (endDate && typeof endDate === 'string') {
      filters.endDate = new Date(endDate);
    }
    if (mealType && typeof mealType === 'string') {
      filters.mealType = mealType as MealType;
    }
    if (limit && typeof limit === 'string') {
      filters.limit = parseInt(limit);
    }
    if (offset && typeof offset === 'string') {
      filters.offset = parseInt(offset);
    }

    const mealLogs = await nutritionService.getMealLogsByPatient(patientId, filters);

    res.json({ mealLogs });
  }

  /**
   * Create a new meal log
   * POST /patients/:patientId/meals
   */
  async createMealLog(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { patientId } = req.params;

    // Validate request body
    const validation = createMealLogSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ApiError(
        ErrorCodes.VALIDATION_ERROR,
        'Invalid meal log data',
        400,
        validation.error.errors
      );
    }

    const data = validation.data;

    // Verify patient ID matches
    if (data.patientId !== patientId) {
      throw new ApiError(ErrorCodes.BAD_REQUEST, 'Patient ID mismatch', 400);
    }

    // Verify user has access to this patient
    await this.verifyPatientAccess(userId, patientId);

    // Get the user record
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'User not found', 404);
    }

    let analysisResult = null;

    // Run AI analysis if requested and photos provided
    if (data.analyzeWithAI && data.photoUrls.length > 0) {
      try {
        logger.info('Running AI meal analysis', {
          patientId,
          photoCount: data.photoUrls.length,
        });

        // Get active nutrition recommendation for this patient
        const nutritionGoals = await nutritionService.getActiveNutritionRecommendation(patientId);

        // Analyze meal with GPT-5.1 Vision
        if (data.photoUrls.length === 1) {
          analysisResult = await mealAnalysisService.analyzeMealFromPhoto({
            photoUrl: data.photoUrls[0],
            nutritionGoals,
            mealType: data.mealType as MealType,
          });
        } else {
          analysisResult = await mealAnalysisService.analyzeMultiplePhotos({
            photoUrls: data.photoUrls,
            nutritionGoals,
            mealType: data.mealType as MealType,
          });
        }

        logger.info('AI meal analysis completed', {
          confidence: analysisResult.confidence,
          foodItems: analysisResult.nutritionData.foodItems.length,
          concerns: analysisResult.concerns.length,
        });
      } catch (error) {
        logger.error('AI meal analysis failed, continuing without analysis:', error);
        // Continue without AI analysis rather than failing the entire request
      }
    }

    // Create meal log with analysis results
    const mealLog = await nutritionService.createMealLog({
      patientId: data.patientId,
      userId: user.id,
      mealType: data.mealType as MealType,
      consumedAt: data.consumedAt ? new Date(data.consumedAt) : undefined,
      notes: data.notes,
      photoUrls: data.photoUrls,
      voiceNoteUrl: data.voiceNoteUrl,
      templateId: data.templateId,
      nutritionData: analysisResult?.nutritionData,
      meetsGuidelines: analysisResult?.meetsGuidelines,
      concerns: analysisResult?.concerns,
    });

    res.status(201).json({
      mealLog,
      analysis: analysisResult,
    });
  }

  /**
   * Get today's meals for a patient
   * GET /patients/:patientId/meals/today
   */
  async getTodaysMeals(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { patientId } = req.params;

    // Verify user has access to this patient
    await this.verifyPatientAccess(userId, patientId);

    const meals = await nutritionService.getTodaysMeals(patientId);

    res.json({ meals });
  }

  /**
   * Get weekly summary for a patient
   * GET /patients/:patientId/meals/weekly-summary
   */
  async getWeeklySummary(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { patientId } = req.params;

    // Verify user has access to this patient
    await this.verifyPatientAccess(userId, patientId);

    const summary = await nutritionService.getWeeklySummary(patientId);

    res.json({ summary });
  }

  /**
   * Update a meal log
   * PUT /meals/:mealLogId
   */
  async updateMealLog(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { mealLogId } = req.params;

    // Validate request body
    const validation = updateMealLogSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ApiError(
        ErrorCodes.VALIDATION_ERROR,
        'Invalid update data',
        400,
        validation.error.errors
      );
    }

    const data = validation.data;

    // Get existing meal log and verify access
    const existingMealLog = await nutritionService.getMealLogById(mealLogId);
    if (!existingMealLog) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Meal log not found', 404);
    }

    await this.verifyPatientAccess(userId, existingMealLog.patientId);

    // Update meal log
    const updateData: any = {};
    if (data.mealType) updateData.mealType = data.mealType;
    if (data.consumedAt) updateData.consumedAt = new Date(data.consumedAt);
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.photoUrls) updateData.photoUrls = data.photoUrls;
    if (data.voiceNoteUrl !== undefined) updateData.voiceNoteUrl = data.voiceNoteUrl;

    const mealLog = await nutritionService.updateMealLog(mealLogId, updateData);

    res.json({ mealLog });
  }

  /**
   * Delete a meal log
   * DELETE /meals/:mealLogId
   */
  async deleteMealLog(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { mealLogId } = req.params;

    // Get existing meal log and verify access
    const existingMealLog = await nutritionService.getMealLogById(mealLogId);
    if (!existingMealLog) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Meal log not found', 404);
    }

    await this.verifyPatientAccess(userId, existingMealLog.patientId);

    // Delete meal log
    await nutritionService.deleteMealLog(mealLogId);

    res.status(204).send();
  }

  /**
   * Get meal templates for a patient
   * GET /patients/:patientId/meal-templates
   */
  async getMealTemplates(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { patientId } = req.params;

    // Verify user has access to this patient
    await this.verifyPatientAccess(userId, patientId);

    const templates = await nutritionService.getMealTemplates(patientId);

    res.json({ templates });
  }

  /**
   * Create a meal template
   * POST /patients/:patientId/meal-templates
   */
  async createMealTemplate(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { patientId } = req.params;

    // Validate request body
    const validation = createMealTemplateSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ApiError(
        ErrorCodes.VALIDATION_ERROR,
        'Invalid template data',
        400,
        validation.error.errors
      );
    }

    const data = validation.data;

    // Verify patient ID matches
    if (data.patientId !== patientId) {
      throw new ApiError(ErrorCodes.BAD_REQUEST, 'Patient ID mismatch', 400);
    }

    // Verify user has access to this patient
    await this.verifyPatientAccess(userId, patientId);

    // Get the user record
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'User not found', 404);
    }

    // Create template
    const template = await nutritionService.createMealTemplate({
      patientId: data.patientId,
      createdById: user.id,
      name: data.name,
      mealType: data.mealType as MealType,
      nutritionData: data.nutritionData,
      photoUrl: data.photoUrl,
    });

    res.status(201).json({ template });
  }

  /**
   * Update a meal template
   * PUT /meal-templates/:templateId
   */
  async updateMealTemplate(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { templateId } = req.params;

    // Validate request body
    const validation = updateMealTemplateSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ApiError(
        ErrorCodes.VALIDATION_ERROR,
        'Invalid update data',
        400,
        validation.error.errors
      );
    }

    const data = validation.data;

    // Get existing template and verify access
    const existingTemplate = await prisma.mealTemplate.findUnique({
      where: { id: templateId },
    });

    if (!existingTemplate) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Template not found', 404);
    }

    await this.verifyPatientAccess(userId, existingTemplate.patientId);

    // Update template
    const template = await nutritionService.updateMealTemplate(templateId, data);

    res.json({ template });
  }

  /**
   * Delete a meal template
   * DELETE /meal-templates/:templateId
   */
  async deleteMealTemplate(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { templateId } = req.params;

    // Get existing template and verify access
    const existingTemplate = await prisma.mealTemplate.findUnique({
      where: { id: templateId },
    });

    if (!existingTemplate) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Template not found', 404);
    }

    await this.verifyPatientAccess(userId, existingTemplate.patientId);

    // Delete template (soft delete)
    await nutritionService.deleteMealTemplate(templateId);

    res.status(204).send();
  }

  /**
   * Create nutrition recommendation details
   * POST /recommendations/:recommendationId/nutrition-details
   */
  async createNutritionRecommendation(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { recommendationId } = req.params;

    // Validate request body
    const validation = createNutritionRecommendationSchema.safeParse({
      ...req.body,
      recommendationId,
    });

    if (!validation.success) {
      throw new ApiError(
        ErrorCodes.VALIDATION_ERROR,
        'Invalid nutrition recommendation data',
        400,
        validation.error.errors
      );
    }

    const data = validation.data as any;

    // Verify recommendation exists and user has access
    const recommendation = await prisma.recommendation.findUnique({
      where: { id: recommendationId },
      include: {
        patient: true,
      },
    });

    if (!recommendation) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Recommendation not found', 404);
    }

    if (recommendation.type !== 'DIET') {
      throw new ApiError(
        ErrorCodes.BAD_REQUEST,
        'Only DIET recommendations can have nutrition details',
        400
      );
    }

    await this.verifyPatientAccess(userId, recommendation.patient.id);

    // Create nutrition recommendation
    const nutritionRec = await nutritionService.createNutritionRecommendation(data);

    res.status(201).json({ nutritionRecommendation: nutritionRec });
  }

  /**
   * Get nutrition recommendation details
   * GET /recommendations/:recommendationId/nutrition-details
   */
  async getNutritionRecommendation(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { recommendationId } = req.params;

    // Verify recommendation exists and user has access
    const recommendation = await prisma.recommendation.findUnique({
      where: { id: recommendationId },
      include: {
        patient: true,
      },
    });

    if (!recommendation) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Recommendation not found', 404);
    }

    await this.verifyPatientAccess(userId, recommendation.patient.id);

    // Get nutrition recommendation
    const nutritionRec = await nutritionService.getNutritionRecommendationByRecommendationId(
      recommendationId
    );

    if (!nutritionRec) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Nutrition recommendation not found', 404);
    }

    res.json({ nutritionRecommendation: nutritionRec });
  }

  /**
   * Get presigned URL for photo upload
   * POST /nutrition/upload-url/photo
   */
  async getPhotoUploadUrl(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;

    // Validate request body
    const validation = uploadUrlSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ApiError(
        ErrorCodes.VALIDATION_ERROR,
        'Invalid upload request',
        400,
        validation.error.errors
      );
    }

    const { fileName, fileType } = validation.data;

    // Get user's family ID
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (!user || user.familyMembers.length === 0) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'No family found', 404);
    }

    const familyId = user.familyMembers[0].familyId;

    // Generate presigned URL for S3 upload
    const uploadUrl = await s3Service.getPresignedUploadUrl(familyId, fileName, fileType);

    res.json({ uploadUrl });
  }

  /**
   * Get presigned URL for voice note upload
   * POST /nutrition/upload-url/voice
   */
  async getVoiceNoteUploadUrl(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;

    // Validate request body
    const validation = uploadUrlSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ApiError(
        ErrorCodes.VALIDATION_ERROR,
        'Invalid upload request',
        400,
        validation.error.errors
      );
    }

    const { fileName, fileType } = validation.data;

    // Get user's family ID
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (!user || user.familyMembers.length === 0) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'No family found', 404);
    }

    const familyId = user.familyMembers[0].familyId;

    // Generate presigned URL for S3 upload
    const uploadUrl = await s3Service.getPresignedUploadUrl(familyId, fileName, fileType);

    res.json({ uploadUrl });
  }

  /**
   * Verify user has access to a patient
   */
  private async verifyPatientAccess(userId: string, patientId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: {
            family: {
              include: {
                patient: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'User not found', 404);
    }

    const hasAccess = user.familyMembers.some((fm) => fm.family.patient?.id === patientId);

    if (!hasAccess) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Access denied to this patient', 403);
    }
  }
}

export const nutritionController = new NutritionController();
