import { Router } from 'express';
import { medicationController } from '../controllers/medication.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all medications (for calendar)
router.get('/medications', async (req, res, next) => {
  try {
    await medicationController.getMedications(req, res);
  } catch (error) {
    next(error);
  }
});

// Medication management
router.post('/medications', async (req, res, next) => {
  try {
    await medicationController.createMedication(req, res);
  } catch (error) {
    next(error);
  }
});

router.get('/patients/:patientId/medications', async (req, res, next) => {
  try {
    await medicationController.getPatientMedications(req, res);
  } catch (error) {
    next(error);
  }
});

router.get('/patients/:patientId/medications/today', async (req, res, next) => {
  try {
    await medicationController.getTodaysMedications(req, res);
  } catch (error) {
    next(error);
  }
});

router.put('/medications/:medicationId', async (req, res, next) => {
  try {
    await medicationController.updateMedication(req, res);
  } catch (error) {
    next(error);
  }
});

router.post('/medications/:medicationId/log', async (req, res, next) => {
  try {
    await medicationController.logMedication(req, res);
  } catch (error) {
    next(error);
  }
});

router.post('/medications/:medicationId/refill', async (req, res, next) => {
  try {
    await medicationController.refillMedication(req, res);
  } catch (error) {
    next(error);
  }
});

router.delete('/medications/:medicationId', async (req, res, next) => {
  try {
    await medicationController.deleteMedication(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;