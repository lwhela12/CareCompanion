import { prisma } from '@carecompanion/database';
import { logger } from '../utils/logger';
import { toZonedTime, format } from 'date-fns-tz';

/**
 * Notification preference structure
 */
export interface NotificationPreferences {
  // Master email toggle
  emailEnabled: boolean;

  // Notification types
  medicationReminders: boolean;
  careTaskReminders: boolean;
  insightAlerts: boolean;
  dailySummaries: boolean;
  weeklyReports: boolean;

  // Quiet hours (no notifications during this time)
  quietHoursEnabled: boolean;
  quietHoursStart: string | null; // Format: "HH:MM" (24-hour)
  quietHoursEnd: string | null; // Format: "HH:MM" (24-hour)
  quietHoursTimezone: string | null; // IANA timezone (e.g., "America/New_York")

  // Future features
  smsEnabled: boolean;
  phoneNumber: string | null;
  pushEnabled: boolean;
}

/**
 * Default notification preferences for new users
 * Critical notifications (medication, care tasks) ON by default
 * Optional digests OFF to prevent email fatigue
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailEnabled: true,
  medicationReminders: true,
  careTaskReminders: true,
  insightAlerts: true,
  dailySummaries: false,
  weeklyReports: false,
  quietHoursEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
  quietHoursTimezone: null,
  smsEnabled: false,
  phoneNumber: null,
  pushEnabled: false,
};

/**
 * Notification types that can be sent
 */
export type NotificationType = 'medication' | 'careTask' | 'insight' | 'dailySummary' | 'weeklyReport';

/**
 * Service for managing user notification preferences
 */
export class UserSettingsService {
  /**
   * Get user's notification preferences, merged with defaults
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true },
    });

    // Merge user preferences with defaults
    const userPrefs = (user?.notificationPreferences as Partial<NotificationPreferences>) || {};

    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...userPrefs,
    };
  }

  /**
   * Update user's notification preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    // Get current preferences
    const currentPrefs = await this.getUserPreferences(userId);

    // Merge with new preferences
    const updatedPrefs = {
      ...currentPrefs,
      ...preferences,
    };

    // Update in database
    await prisma.user.update({
      where: { id: userId },
      data: {
        notificationPreferences: updatedPrefs as any,
      },
    });

    logger.info('User notification preferences updated', {
      userId,
      updatedFields: Object.keys(preferences),
    });

    return updatedPrefs;
  }

  /**
   * Check if a notification should be sent to a user
   * Respects user preferences, quiet hours, and notification type
   *
   * @param userId - User's database ID
   * @param notificationType - Type of notification to send
   * @param scheduledTime - Optional: When the notification is scheduled for (for quiet hours check)
   * @param isCritical - Optional: If true, bypasses quiet hours (for emergency notifications)
   */
  async shouldSendNotification(
    userId: string,
    notificationType: NotificationType,
    scheduledTime?: Date,
    isCritical: boolean = false
  ): Promise<boolean> {
    try {
      const prefs = await this.getUserPreferences(userId);

      // Check if email notifications are enabled at all
      if (!prefs.emailEnabled) {
        logger.debug('Email notifications disabled for user', { userId });
        return false;
      }

      // Check if this specific notification type is enabled
      const typeEnabledMap: Record<NotificationType, boolean> = {
        medication: prefs.medicationReminders,
        careTask: prefs.careTaskReminders,
        insight: prefs.insightAlerts,
        dailySummary: prefs.dailySummaries,
        weeklyReport: prefs.weeklyReports,
      };

      if (!typeEnabledMap[notificationType]) {
        logger.debug('Notification type disabled for user', {
          userId,
          notificationType,
        });
        return false;
      }

      // Check quiet hours (skip if critical notification)
      if (
        !isCritical &&
        prefs.quietHoursEnabled &&
        prefs.quietHoursStart &&
        prefs.quietHoursEnd &&
        prefs.quietHoursTimezone &&
        scheduledTime
      ) {
        const isInQuietHours = this.isInQuietHours(
          scheduledTime,
          prefs.quietHoursStart,
          prefs.quietHoursEnd,
          prefs.quietHoursTimezone
        );

        if (isInQuietHours) {
          logger.debug('Notification blocked by quiet hours', {
            userId,
            notificationType,
            scheduledTime: scheduledTime.toISOString(),
          });
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('Error checking notification preferences', {
        userId,
        notificationType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Fail open: if we can't check preferences, allow the notification
      // This ensures critical notifications aren't lost due to technical issues
      return true;
    }
  }

  /**
   * Check if a given time falls within quiet hours
   * Handles overnight quiet hours (e.g., 22:00 to 08:00)
   */
  private isInQuietHours(
    time: Date,
    quietStart: string,
    quietEnd: string,
    timezone: string
  ): boolean {
    try {
      // Convert UTC time to user's timezone
      const zonedTime = toZonedTime(time, timezone);
      const currentTime = format(zonedTime, 'HH:mm', { timeZone: timezone });

      // Handle overnight quiet hours (e.g., 22:00 to 08:00)
      if (quietStart > quietEnd) {
        // Quiet hours span midnight
        return currentTime >= quietStart || currentTime < quietEnd;
      }

      // Normal quiet hours (e.g., 08:00 to 17:00)
      return currentTime >= quietStart && currentTime < quietEnd;
    } catch (error) {
      logger.error('Error checking quiet hours', {
        error: error instanceof Error ? error.message : 'Unknown error',
        time: time.toISOString(),
        quietStart,
        quietEnd,
        timezone,
      });

      // If we can't determine quiet hours, assume not in quiet hours
      return false;
    }
  }
}

export const userSettingsService = new UserSettingsService();
