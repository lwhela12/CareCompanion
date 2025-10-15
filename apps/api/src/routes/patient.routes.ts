import { Router } from 'express';
import { patientController } from '../controllers/patient.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get today's checklist for patient (patient portal view)
router.get('/patients/:patientId/checklist/today', async (req, res, next) => {
  try {
    await patientController.getTodaysChecklist(req, res);
  } catch (error) {
    next(error);
  }
});

// Log checklist item completion
router.post('/patients/checklist/:itemId/log', async (req, res, next) => {
  try {
    await patientController.logChecklistItem(req, res);
  } catch (error) {
    next(error);
  }
});

// Get all checklist items for a patient (caregiver view)
router.get('/patients/:patientId/checklist', async (req, res, next) => {
  try {
    await patientController.getChecklistItems(req, res);
  } catch (error) {
    next(error);
  }
});

// Create checklist item (caregiver only)
router.post('/patients/checklist', async (req, res, next) => {
  try {
    await patientController.createChecklistItem(req, res);
  } catch (error) {
    next(error);
  }
});

// Update checklist item
router.put('/patients/checklist/:itemId', async (req, res, next) => {
  try {
    await patientController.updateChecklistItem(req, res);
  } catch (error) {
    next(error);
  }
});

// Delete checklist item
router.delete('/patients/checklist/:itemId', async (req, res, next) => {
  try {
    await patientController.deleteChecklistItem(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
