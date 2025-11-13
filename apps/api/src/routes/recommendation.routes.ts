import { Router } from 'express';
import { recommendationController } from '../controllers/recommendation.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all recommendations for family
router.get('/recommendations', async (req, res, next) => {
  try {
    await recommendationController.getRecommendations(req, res);
  } catch (error) {
    next(error);
  }
});

// Get single recommendation
router.get('/recommendations/:id', async (req, res, next) => {
  try {
    await recommendationController.getRecommendation(req, res);
  } catch (error) {
    next(error);
  }
});

// Edit recommendation
router.put('/recommendations/:id', async (req, res, next) => {
  try {
    await recommendationController.updateRecommendation(req, res);
  } catch (error) {
    next(error);
  }
});

// Acknowledge recommendation
router.post('/recommendations/:id/acknowledge', async (req, res, next) => {
  try {
    await recommendationController.acknowledgeRecommendation(req, res);
  } catch (error) {
    next(error);
  }
});

// Accept recommendation (creates linked entity)
router.post('/recommendations/:id/accept', async (req, res, next) => {
  try {
    await recommendationController.acceptRecommendation(req, res);
  } catch (error) {
    next(error);
  }
});

// Dismiss recommendation
router.post('/recommendations/:id/dismiss', async (req, res, next) => {
  try {
    await recommendationController.dismissRecommendation(req, res);
  } catch (error) {
    next(error);
  }
});

// Bulk accept multiple recommendations
router.post('/recommendations/bulk-accept', async (req, res, next) => {
  try {
    await recommendationController.bulkAcceptRecommendations(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
