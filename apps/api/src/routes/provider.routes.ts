import { Router } from 'express';
import { providerController } from '../controllers/provider.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all providers for family
router.get('/providers', async (req, res, next) => {
  try {
    await providerController.getProviders(req, res);
  } catch (error) {
    next(error);
  }
});

// Get single provider
router.get('/providers/:id', async (req, res, next) => {
  try {
    await providerController.getProvider(req, res);
  } catch (error) {
    next(error);
  }
});

// Create provider manually
router.post('/providers', async (req, res, next) => {
  try {
    await providerController.createProvider(req, res);
  } catch (error) {
    next(error);
  }
});

// Update provider
router.put('/providers/:id', async (req, res, next) => {
  try {
    await providerController.updateProvider(req, res);
  } catch (error) {
    next(error);
  }
});

// Set provider as primary
router.patch('/providers/:id/primary', async (req, res, next) => {
  try {
    await providerController.setPrimaryProvider(req, res);
  } catch (error) {
    next(error);
  }
});

// Soft delete provider
router.delete('/providers/:id', async (req, res, next) => {
  try {
    await providerController.deleteProvider(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
