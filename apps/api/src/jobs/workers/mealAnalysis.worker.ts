import { Worker, Job } from 'bullmq';
import { prisma } from '@carecompanion/database';
import { MealType } from '@prisma/client';
import { logger } from '../../utils/logger';
import { mealAnalysisService } from '../../services/ai/mealAnalysis.service';
import { nutritionService } from '../../services/nutrition.service';

/**
 * Job data for meal analysis
 */
export interface MealAnalysisJobData {
  mealLogId: string;
  patientId: string;
  photoUrls: string[];
  description?: string;
  mealType: string;
}

/**
 * Analyze a meal with AI and update the meal log
 */
async function analyzeMeal(job: Job<MealAnalysisJobData>) {
  const { mealLogId, patientId, photoUrls, description, mealType } = job.data;

  logger.info('Starting meal analysis', {
    jobId: job.id,
    mealLogId,
    patientId,
    photoCount: photoUrls.length,
    hasDescription: !!description,
  });

  try {
    // Update status to PROCESSING
    await prisma.mealLog.update({
      where: { id: mealLogId },
      data: { analysisStatus: 'PROCESSING' },
    });

    // Get active nutrition recommendation for this patient
    const nutritionGoals = await nutritionService.getActiveNutritionRecommendation(patientId);

    // Fetch patient's dietary info for personalized analysis
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { allergies: true, dietaryRestrictions: true },
    });

    const patientContext = {
      allergies: patient?.allergies || [],
      dietaryRestrictions: patient?.dietaryRestrictions || [],
    };

    logger.info('Patient dietary context', {
      mealLogId,
      hasAllergies: patientContext.allergies.length > 0,
      hasRestrictions: patientContext.dietaryRestrictions.length > 0,
    });

    let analysisResult;

    // Analyze meal - prefer photos if available, otherwise use description
    if (photoUrls.length === 1) {
      logger.info('Analyzing single photo', { mealLogId });
      analysisResult = await mealAnalysisService.analyzeMealFromPhoto({
        photoUrl: photoUrls[0],
        nutritionGoals,
        mealType: mealType as MealType,
        patientContext,
      });
    } else if (photoUrls.length > 1) {
      logger.info('Analyzing multiple photos', { mealLogId, count: photoUrls.length });
      analysisResult = await mealAnalysisService.analyzeMultiplePhotos({
        photoUrls,
        nutritionGoals,
        mealType: mealType as MealType,
        patientContext,
      });
    } else if (description?.trim()) {
      logger.info('Analyzing from description', { mealLogId });
      analysisResult = await mealAnalysisService.analyzeMealFromDescription({
        description,
        nutritionGoals,
        mealType: mealType as MealType,
        patientContext,
      });
    } else {
      throw new Error('No photos or description provided for analysis');
    }

    // Update meal log with analysis results
    await prisma.mealLog.update({
      where: { id: mealLogId },
      data: {
        nutritionData: analysisResult.nutritionData,
        meetsGuidelines: analysisResult.meetsGuidelines,
        concerns: analysisResult.concerns,
        analysisStatus: 'COMPLETED',
      },
    });

    logger.info('Meal analysis completed', {
      mealLogId,
      confidence: analysisResult.confidence,
      foodItems: analysisResult.nutritionData.foodItems?.length || 0,
      concerns: analysisResult.concerns.length,
    });

    return {
      success: true,
      mealLogId,
      confidence: analysisResult.confidence,
    };
  } catch (error) {
    logger.error('Meal analysis failed', {
      jobId: job.id,
      mealLogId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Update status to FAILED
    await prisma.mealLog.update({
      where: { id: mealLogId },
      data: { analysisStatus: 'FAILED' },
    });

    throw error; // Re-throw to mark the job as failed
  }
}

/**
 * Create and export the meal analysis worker
 */
export function createMealAnalysisWorker(connection: any) {
  const worker = new Worker('meal-analysis', analyzeMeal, {
    connection,
    concurrency: 3, // Process up to 3 meals concurrently
    limiter: {
      max: 5, // Max 5 jobs
      duration: 1000, // per second
    },
  });

  worker.on('completed', (job) => {
    logger.info('Meal analysis job completed', {
      jobId: job.id,
      mealLogId: job.data.mealLogId,
      returnValue: job.returnvalue,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error('Meal analysis job failed', {
      jobId: job?.id,
      mealLogId: job?.data?.mealLogId,
      error: err.message,
      stack: err.stack,
    });
  });

  worker.on('error', (err) => {
    logger.error('Meal analysis worker error', {
      error: err.message,
      stack: err.stack,
    });
  });

  return worker;
}
