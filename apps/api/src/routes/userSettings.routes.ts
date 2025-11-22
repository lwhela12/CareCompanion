import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { userSettingsController } from '../controllers/userSettings.controller';

const router = Router();

/**
 * All user settings routes require authentication
 * Routes are prefixed with /api/v1/users
 */

/**
 * GET /api/v1/users/notification-preferences
 * Get current user's notification preferences
 */
router.get('/notification-preferences', authenticate, async (req, res, next) => {
  try {
    await userSettingsController.getNotificationPreferences(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/users/notification-preferences
 * Update current user's notification preferences
 */
router.patch('/notification-preferences', authenticate, async (req, res, next) => {
  try {
    await userSettingsController.updateNotificationPreferences(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
