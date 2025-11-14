import { Router } from 'express';
import { calendarController } from '../controllers/calendar.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// OAuth initiation (requires authentication)
router.get('/auth/google', authenticate, async (req, res, next) => {
  try {
    await calendarController.initiateGoogleAuth(req, res);
  } catch (error) {
    next(error);
  }
});

// OAuth callback (no authentication required - handled via state parameter)
router.get('/callback/google', async (req, res, next) => {
  try {
    await calendarController.handleGoogleCallback(req, res);
  } catch (error) {
    next(error);
  }
});

// All other routes require authentication
router.use(authenticate);

// Get all connections for current user/family
router.get('/connections', async (req, res, next) => {
  try {
    await calendarController.getConnections(req, res);
  } catch (error) {
    next(error);
  }
});

// Update connection settings
router.put('/connections/:connectionId', async (req, res, next) => {
  try {
    await calendarController.updateConnection(req, res);
  } catch (error) {
    next(error);
  }
});

// Delete connection
router.delete('/connections/:connectionId', async (req, res, next) => {
  try {
    await calendarController.deleteConnection(req, res);
  } catch (error) {
    next(error);
  }
});

// Manual sync
router.post('/connections/:connectionId/sync', async (req, res, next) => {
  try {
    await calendarController.manualSync(req, res);
  } catch (error) {
    next(error);
  }
});

// Get sync logs
router.get('/connections/:connectionId/logs', async (req, res, next) => {
  try {
    await calendarController.getSyncLogs(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
