import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '@carecompanion/database';
import { AuthRequest } from '../types';
import { userSettingsService, NotificationPreferences } from '../services/userSettings.service';
import { ApiError } from '../middleware/error';
import { ErrorCodes } from '@carecompanion/shared';
import { logger } from '../utils/logger';

/**
 * Validation schema for updating notification preferences
 */
const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  medicationReminders: z.boolean().optional(),
  careTaskReminders: z.boolean().optional(),
  insightAlerts: z.boolean().optional(),
  dailySummaries: z.boolean().optional(),
  weeklyReports: z.boolean().optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format (24-hour)')
    .nullable()
    .optional(),
  quietHoursEnd: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format (24-hour)')
    .nullable()
    .optional(),
  quietHoursTimezone: z.string().nullable().optional(),
  smsEnabled: z.boolean().optional(),
  phoneNumber: z.string().nullable().optional(),
  pushEnabled: z.boolean().optional(),
});

/**
 * Controller for user settings and preferences
 */
export class UserSettingsController {
  /**
   * GET /api/v1/users/notification-preferences
   * Get current user's notification preferences
   */
  async getNotificationPreferences(req: AuthRequest, res: Response): Promise<void> {
    const clerkUserId = req.auth!.userId;

    // Get internal user ID from Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true },
    });

    if (!user) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'User not found', 404);
    }

    const preferences = await userSettingsService.getUserPreferences(user.id);

    logger.debug('Retrieved notification preferences', {
      userId: user.id,
      clerkUserId,
    });

    res.json({ preferences });
  }

  /**
   * PATCH /api/v1/users/notification-preferences
   * Update current user's notification preferences
   */
  async updateNotificationPreferences(req: AuthRequest, res: Response): Promise<void> {
    // Validate input
    const validation = updatePreferencesSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ApiError(
        ErrorCodes.VALIDATION_ERROR,
        'Invalid notification preferences',
        400,
        validation.error.errors
      );
    }

    const clerkUserId = req.auth!.userId;

    // Get internal user ID from Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'User not found', 404);
    }

    // Validate quiet hours configuration
    const prefs = validation.data;
    if (prefs.quietHoursEnabled) {
      if (!prefs.quietHoursStart || !prefs.quietHoursEnd || !prefs.quietHoursTimezone) {
        throw new ApiError(
          ErrorCodes.VALIDATION_ERROR,
          'Quiet hours requires start time, end time, and timezone',
          400
        );
      }
    }

    // Update preferences
    const updatedPreferences = await userSettingsService.updateUserPreferences(
      user.id,
      validation.data
    );

    logger.info('User updated notification preferences', {
      userId: user.id,
      clerkUserId,
      userName: `${user.firstName} ${user.lastName}`,
      updatedFields: Object.keys(validation.data),
    });

    res.json({
      message: 'Notification preferences updated successfully',
      preferences: updatedPreferences,
    });
  }
}

export const userSettingsController = new UserSettingsController();
