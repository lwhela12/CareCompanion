import { PrismaClient, MealLog, MealTemplate, NutritionRecommendation, MealType, AnalysisStatus } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

interface CreateMealLogParams {
  patientId: string;
  userId: string;
  mealType: MealType;
  consumedAt?: Date;
  description?: string;
  photoUrls: string[];
  voiceNoteUrl?: string;
  templateId?: string;
  nutritionData?: any;
  meetsGuidelines?: boolean;
  concerns?: string[];
  analysisStatus?: AnalysisStatus;
}

interface CreateMealTemplateParams {
  patientId: string;
  createdById: string;
  name: string;
  mealType: MealType;
  nutritionData: any;
  photoUrl?: string;
}

interface CreateNutritionRecommendationParams {
  recommendationId: string;
  dailyCalories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  sodiumMg?: number;
  restrictions?: string[];
  goals?: string[];
  specialInstructions?: string;
  recommendedMealTimes?: string[];
}

interface WeeklySummary {
  totalMeals: number;
  mealsByType: Record<MealType, number>;
  averageCalories: number | null;
  averageProtein: number | null;
  totalConcerns: number;
  topConcerns: string[];
  guidelineAdherence: number | null; // percentage 0-100
  daysWithMeals: number;
}

interface DailySummary {
  date: string;
  meals: MealLog[];
  totalCalories: number | null;
  totalProtein: number | null;
  concernCount: number;
}

export class NutritionService {
  /**
   * Create a meal log with automatic journal entry creation
   */
  async createMealLog(params: CreateMealLogParams): Promise<MealLog> {
    try {
      logger.info('Creating meal log', {
        patientId: params.patientId,
        mealType: params.mealType,
        hasPhotos: params.photoUrls.length > 0,
      });

      return await prisma.$transaction(async (tx) => {
        // Create meal log
        const mealLog = await tx.mealLog.create({
          data: {
            patientId: params.patientId,
            userId: params.userId,
            mealType: params.mealType,
            consumedAt: params.consumedAt || new Date(),
            description: params.description,
            photoUrls: params.photoUrls,
            voiceNoteUrl: params.voiceNoteUrl,
            nutritionData: params.nutritionData || {},
            meetsGuidelines: params.meetsGuidelines,
            concerns: params.concerns || [],
            analysisStatus: params.analysisStatus || 'NONE',
            templateId: params.templateId,
          },
          include: {
            patient: {
              select: {
                firstName: true,
                lastName: true,
                familyId: true,
              },
            },
            loggedBy: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            template: true,
          },
        });

        // Auto-create journal entry
        const journalContent = this.generateJournalContent(mealLog);

        const journalEntry = await tx.journalEntry.create({
          data: {
            familyId: mealLog.patient.familyId,
            userId: params.userId,
            content: journalContent,
            isPrivate: false,
            attachmentUrls: params.photoUrls,
            analysisData: {
              source: 'meal_log',
              mealLogId: mealLog.id,
              mealType: params.mealType,
              hasConcerns: (params.concerns || []).length > 0,
              meetsGuidelines: params.meetsGuidelines,
              foodItems: params.nutritionData?.foodItems || [],
            },
          },
        });

        // Link journal entry to meal log
        const updatedMealLog = await tx.mealLog.update({
          where: { id: mealLog.id },
          data: { journalEntryId: journalEntry.id },
          include: {
            patient: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            loggedBy: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            template: true,
            journalEntry: true,
          },
        });

        logger.info('Meal log created with journal entry', {
          mealLogId: mealLog.id,
          journalEntryId: journalEntry.id,
        });

        return updatedMealLog;
      });
    } catch (error) {
      logger.error('Error creating meal log:', error);
      throw error;
    }
  }

  /**
   * Get meal logs for a patient with optional filters
   */
  async getMealLogsByPatient(
    patientId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      mealType?: MealType;
      limit?: number;
      offset?: number;
    }
  ): Promise<MealLog[]> {
    try {
      const where: any = { patientId };

      if (filters?.startDate || filters?.endDate) {
        where.consumedAt = {};
        if (filters.startDate) {
          where.consumedAt.gte = filters.startDate;
        }
        if (filters.endDate) {
          where.consumedAt.lt = filters.endDate;
        }
      }

      if (filters?.mealType) {
        where.mealType = filters.mealType;
      }

      const mealLogs = await prisma.mealLog.findMany({
        where,
        include: {
          patient: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          loggedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          template: true,
        },
        orderBy: { consumedAt: 'desc' },
        take: filters?.limit,
        skip: filters?.offset,
      });

      return mealLogs;
    } catch (error) {
      logger.error('Error fetching meal logs:', error);
      throw error;
    }
  }

  /**
   * Get today's meals for a patient
   */
  async getTodaysMeals(patientId: string): Promise<MealLog[]> {
    try {
      const now = new Date();

      // Get start of today in UTC
      const today = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0, 0, 0, 0
      ));

      // Get start of tomorrow in UTC
      const tomorrow = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0, 0, 0, 0
      ));

      return await this.getMealLogsByPatient(patientId, {
        startDate: today,
        endDate: tomorrow,
      });
    } catch (error) {
      logger.error('Error fetching today\'s meals:', error);
      throw error;
    }
  }

  /**
   * Get meal log by ID
   */
  async getMealLogById(id: string): Promise<MealLog | null> {
    try {
      return await prisma.mealLog.findUnique({
        where: { id },
        include: {
          patient: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          loggedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          template: true,
          journalEntry: true,
        },
      });
    } catch (error) {
      logger.error('Error fetching meal log:', error);
      throw error;
    }
  }

  /**
   * Update meal log
   */
  async updateMealLog(id: string, data: Partial<CreateMealLogParams>): Promise<MealLog> {
    try {
      logger.info('Updating meal log', { mealLogId: id });

      const updateData: any = {};

      if (data.mealType) updateData.mealType = data.mealType;
      if (data.consumedAt) updateData.consumedAt = data.consumedAt;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.photoUrls) updateData.photoUrls = data.photoUrls;
      if (data.voiceNoteUrl !== undefined) updateData.voiceNoteUrl = data.voiceNoteUrl;
      if (data.nutritionData) updateData.nutritionData = data.nutritionData;
      if (data.meetsGuidelines !== undefined) updateData.meetsGuidelines = data.meetsGuidelines;
      if (data.concerns) updateData.concerns = data.concerns;

      const mealLog = await prisma.mealLog.update({
        where: { id },
        data: updateData,
        include: {
          patient: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          loggedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          template: true,
        },
      });

      logger.info('Meal log updated', { mealLogId: id });

      return mealLog;
    } catch (error) {
      logger.error('Error updating meal log:', error);
      throw error;
    }
  }

  /**
   * Delete meal log
   */
  async deleteMealLog(id: string): Promise<void> {
    try {
      logger.info('Deleting meal log', { mealLogId: id });

      await prisma.mealLog.delete({
        where: { id },
      });

      logger.info('Meal log deleted', { mealLogId: id });
    } catch (error) {
      logger.error('Error deleting meal log:', error);
      throw error;
    }
  }

  /**
   * Get weekly summary for a patient
   */
  async getWeeklySummary(patientId: string): Promise<WeeklySummary> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const mealLogs = await this.getMealLogsByPatient(patientId, {
        startDate: sevenDaysAgo,
      });

      // Calculate summary statistics
      const summary: WeeklySummary = {
        totalMeals: mealLogs.length,
        mealsByType: {
          BREAKFAST: 0,
          LUNCH: 0,
          DINNER: 0,
          SNACK: 0,
          OTHER: 0,
        },
        averageCalories: null,
        averageProtein: null,
        totalConcerns: 0,
        topConcerns: [],
        guidelineAdherence: null,
        daysWithMeals: 0,
      };

      if (mealLogs.length === 0) {
        return summary;
      }

      // Count meals by type
      mealLogs.forEach((meal) => {
        summary.mealsByType[meal.mealType]++;
      });

      // Calculate nutrition averages
      const mealsWithCalories = mealLogs.filter(
        (m) => m.nutritionData && typeof m.nutritionData === 'object' && 'estimatedCalories' in m.nutritionData
      );
      if (mealsWithCalories.length > 0) {
        const totalCalories = mealsWithCalories.reduce(
          (sum, m: any) => sum + (m.nutritionData?.estimatedCalories || 0),
          0
        );
        summary.averageCalories = Math.round(totalCalories / mealsWithCalories.length);
      }

      const mealsWithProtein = mealLogs.filter(
        (m) => m.nutritionData && typeof m.nutritionData === 'object' && 'proteinGrams' in m.nutritionData
      );
      if (mealsWithProtein.length > 0) {
        const totalProtein = mealsWithProtein.reduce(
          (sum, m: any) => sum + (m.nutritionData?.proteinGrams || 0),
          0
        );
        summary.averageProtein = Math.round(totalProtein / mealsWithProtein.length);
      }

      // Count concerns
      const allConcerns: string[] = [];
      mealLogs.forEach((meal) => {
        if (meal.concerns && Array.isArray(meal.concerns)) {
          summary.totalConcerns += meal.concerns.length;
          allConcerns.push(...meal.concerns);
        }
      });

      // Get top concerns
      const concernCounts: Record<string, number> = {};
      allConcerns.forEach((concern) => {
        concernCounts[concern] = (concernCounts[concern] || 0) + 1;
      });
      summary.topConcerns = Object.entries(concernCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([concern]) => concern);

      // Calculate guideline adherence
      const mealsWithGuidelineCheck = mealLogs.filter((m) => m.meetsGuidelines !== null);
      if (mealsWithGuidelineCheck.length > 0) {
        const mealsMetGuidelines = mealsWithGuidelineCheck.filter((m) => m.meetsGuidelines === true).length;
        summary.guidelineAdherence = Math.round((mealsMetGuidelines / mealsWithGuidelineCheck.length) * 100);
      }

      // Count unique days with meals
      const uniqueDays = new Set<string>();
      mealLogs.forEach((meal) => {
        const date = new Date(meal.consumedAt);
        uniqueDays.add(date.toISOString().split('T')[0]);
      });
      summary.daysWithMeals = uniqueDays.size;

      return summary;
    } catch (error) {
      logger.error('Error generating weekly summary:', error);
      throw error;
    }
  }

  /**
   * Create meal template
   */
  async createMealTemplate(params: CreateMealTemplateParams): Promise<MealTemplate> {
    try {
      logger.info('Creating meal template', {
        patientId: params.patientId,
        name: params.name,
      });

      const template = await prisma.mealTemplate.create({
        data: {
          patientId: params.patientId,
          createdById: params.createdById,
          name: params.name,
          mealType: params.mealType,
          nutritionData: params.nutritionData,
          photoUrl: params.photoUrl,
          isActive: true,
        },
        include: {
          patient: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          createdBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      logger.info('Meal template created', { templateId: template.id });

      return template;
    } catch (error) {
      logger.error('Error creating meal template:', error);
      throw error;
    }
  }

  /**
   * Get meal templates for a patient
   */
  async getMealTemplates(patientId: string, activeOnly = true): Promise<MealTemplate[]> {
    try {
      const where: any = { patientId };
      if (activeOnly) {
        where.isActive = true;
      }

      return await prisma.mealTemplate.findMany({
        where,
        include: {
          patient: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          createdBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error('Error fetching meal templates:', error);
      throw error;
    }
  }

  /**
   * Update meal template
   */
  async updateMealTemplate(id: string, data: Partial<CreateMealTemplateParams>): Promise<MealTemplate> {
    try {
      logger.info('Updating meal template', { templateId: id });

      const updateData: any = {};

      if (data.name) updateData.name = data.name;
      if (data.mealType) updateData.mealType = data.mealType;
      if (data.nutritionData) updateData.nutritionData = data.nutritionData;
      if (data.photoUrl !== undefined) updateData.photoUrl = data.photoUrl;

      const template = await prisma.mealTemplate.update({
        where: { id },
        data: updateData,
        include: {
          patient: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          createdBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      logger.info('Meal template updated', { templateId: id });

      return template;
    } catch (error) {
      logger.error('Error updating meal template:', error);
      throw error;
    }
  }

  /**
   * Delete meal template (soft delete by marking inactive)
   */
  async deleteMealTemplate(id: string): Promise<void> {
    try {
      logger.info('Deleting meal template', { templateId: id });

      await prisma.mealTemplate.update({
        where: { id },
        data: { isActive: false },
      });

      logger.info('Meal template deleted (marked inactive)', { templateId: id });
    } catch (error) {
      logger.error('Error deleting meal template:', error);
      throw error;
    }
  }

  /**
   * Create nutrition recommendation (extends DIET type recommendation)
   */
  async createNutritionRecommendation(
    params: CreateNutritionRecommendationParams
  ): Promise<NutritionRecommendation> {
    try {
      logger.info('Creating nutrition recommendation', {
        recommendationId: params.recommendationId,
      });

      const nutritionRec = await prisma.nutritionRecommendation.create({
        data: {
          recommendationId: params.recommendationId,
          dailyCalories: params.dailyCalories,
          proteinGrams: params.proteinGrams,
          carbsGrams: params.carbsGrams,
          fatGrams: params.fatGrams,
          sodiumMg: params.sodiumMg,
          restrictions: params.restrictions || [],
          goals: params.goals || [],
          specialInstructions: params.specialInstructions,
          recommendedMealTimes: params.recommendedMealTimes || [],
        },
        include: {
          recommendation: true,
        },
      });

      logger.info('Nutrition recommendation created', { id: nutritionRec.id });

      return nutritionRec;
    } catch (error) {
      logger.error('Error creating nutrition recommendation:', error);
      throw error;
    }
  }

  /**
   * Get nutrition recommendation by recommendation ID
   */
  async getNutritionRecommendationByRecommendationId(
    recommendationId: string
  ): Promise<NutritionRecommendation | null> {
    try {
      return await prisma.nutritionRecommendation.findUnique({
        where: { recommendationId },
        include: {
          recommendation: true,
        },
      });
    } catch (error) {
      logger.error('Error fetching nutrition recommendation:', error);
      throw error;
    }
  }

  /**
   * Get active nutrition recommendation for a patient
   */
  async getActiveNutritionRecommendation(patientId: string): Promise<NutritionRecommendation | null> {
    try {
      const recommendation = await prisma.recommendation.findFirst({
        where: {
          patientId,
          type: 'DIET',
          status: { in: ['IN_PROGRESS', 'COMPLETED'] },
        },
        include: {
          nutritionDetails: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return recommendation?.nutritionDetails || null;
    } catch (error) {
      logger.error('Error fetching active nutrition recommendation:', error);
      throw error;
    }
  }

  /**
   * Generate journal content from meal log
   */
  private generateJournalContent(mealLog: any): string {
    const mealTypeLabel = mealLog.mealType.toLowerCase();
    const patientName = `${mealLog.patient.firstName} ${mealLog.patient.lastName}`;
    const loggerName = `${mealLog.loggedBy.firstName} ${mealLog.loggedBy.lastName}`;

    let content = `${loggerName} logged ${mealTypeLabel} for ${patientName}`;

    // Add food items if available
    if (mealLog.nutritionData?.foodItems?.length > 0) {
      const items = mealLog.nutritionData.foodItems.slice(0, 5); // Limit to 5 items
      content += `: ${items.join(', ')}`;
      if (mealLog.nutritionData.foodItems.length > 5) {
        content += `, and ${mealLog.nutritionData.foodItems.length - 5} more items`;
      }
    }

    content += '.';

    // Add nutrition summary if available
    if (mealLog.nutritionData?.estimatedCalories || mealLog.nutritionData?.proteinGrams) {
      const nutrition: string[] = [];
      if (mealLog.nutritionData.estimatedCalories) {
        nutrition.push(`~${mealLog.nutritionData.estimatedCalories} cal`);
      }
      if (mealLog.nutritionData.proteinGrams) {
        nutrition.push(`${mealLog.nutritionData.proteinGrams}g protein`);
      }
      content += ` Estimated: ${nutrition.join(', ')}.`;
    }

    // Add template reference if used
    if (mealLog.template) {
      content += ` (Used template: "${mealLog.template.name}")`;
    }

    // Add notes if provided
    if (mealLog.notes) {
      content += `\n\nNotes: ${mealLog.notes}`;
    }

    // Add concerns if any (clinical summary)
    if (mealLog.concerns && mealLog.concerns.length > 0) {
      content += `\n\nConcerns noted: ${mealLog.concerns.join('; ')}`;
    }

    // Add guideline adherence
    if (mealLog.meetsGuidelines !== null) {
      if (mealLog.meetsGuidelines) {
        content += '\n\nMeal meets nutrition guidelines.';
      } else {
        content += '\n\nMeal may need adjustment to meet nutrition guidelines.';
      }
    }

    return content;
  }
}

export const nutritionService = new NutritionService();
