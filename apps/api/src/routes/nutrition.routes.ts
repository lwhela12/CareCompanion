import { Router } from 'express';
import { nutritionController } from '../controllers/nutrition.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Disable caching for all nutrition endpoints
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Meal Logs
router.get('/patients/:patientId/meals', async (req, res, next) => {
  try {
    await nutritionController.getMealLogs(req, res);
  } catch (error) {
    next(error);
  }
});

router.post('/patients/:patientId/meals', async (req, res, next) => {
  try {
    await nutritionController.createMealLog(req, res);
  } catch (error) {
    next(error);
  }
});

router.get('/patients/:patientId/meals/today', async (req, res, next) => {
  try {
    await nutritionController.getTodaysMeals(req, res);
  } catch (error) {
    next(error);
  }
});

router.get('/patients/:patientId/meals/weekly-summary', async (req, res, next) => {
  try {
    await nutritionController.getWeeklySummary(req, res);
  } catch (error) {
    next(error);
  }
});

router.put('/meals/:mealLogId', async (req, res, next) => {
  try {
    await nutritionController.updateMealLog(req, res);
  } catch (error) {
    next(error);
  }
});

router.delete('/meals/:mealLogId', async (req, res, next) => {
  try {
    await nutritionController.deleteMealLog(req, res);
  } catch (error) {
    next(error);
  }
});

// Meal Templates
router.get('/patients/:patientId/meal-templates', async (req, res, next) => {
  try {
    await nutritionController.getMealTemplates(req, res);
  } catch (error) {
    next(error);
  }
});

router.post('/patients/:patientId/meal-templates', async (req, res, next) => {
  try {
    await nutritionController.createMealTemplate(req, res);
  } catch (error) {
    next(error);
  }
});

router.put('/meal-templates/:templateId', async (req, res, next) => {
  try {
    await nutritionController.updateMealTemplate(req, res);
  } catch (error) {
    next(error);
  }
});

router.delete('/meal-templates/:templateId', async (req, res, next) => {
  try {
    await nutritionController.deleteMealTemplate(req, res);
  } catch (error) {
    next(error);
  }
});

// Nutrition Recommendations (extends DIET recommendations)
router.post('/recommendations/:recommendationId/nutrition-details', async (req, res, next) => {
  try {
    await nutritionController.createNutritionRecommendation(req, res);
  } catch (error) {
    next(error);
  }
});

router.get('/recommendations/:recommendationId/nutrition-details', async (req, res, next) => {
  try {
    await nutritionController.getNutritionRecommendation(req, res);
  } catch (error) {
    next(error);
  }
});

// File Uploads
router.post('/nutrition/upload-url/photo', async (req, res, next) => {
  try {
    await nutritionController.getPhotoUploadUrl(req, res);
  } catch (error) {
    next(error);
  }
});

router.post('/nutrition/upload-url/voice', async (req, res, next) => {
  try {
    await nutritionController.getVoiceNoteUploadUrl(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
