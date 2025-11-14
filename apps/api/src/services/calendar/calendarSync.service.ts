import { google } from 'googleapis';
import { prisma, SyncEventType } from '@carecompanion/database';
import { logger } from '../../utils/logger';
import { googleOAuthService } from './googleOAuth.service';

/**
 * Calendar Sync Service
 * Handles syncing CareCompanion events to external calendars (Google, Apple, etc.)
 */
class CalendarSyncService {
  /**
   * Sync a medication event to connected calendars
   */
  async syncMedication(medicationId: string): Promise<void> {
    try {
      const medication = await prisma.medication.findUnique({
        where: { id: medicationId },
        include: {
          patient: {
            include: {
              family: {
                include: {
                  calendarConnections: {
                    where: {
                      syncEnabled: true,
                      syncEventTypes: {
                        has: 'MEDICATION',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!medication || !medication.isActive) {
        logger.debug('Medication not found or inactive', { medicationId });
        return;
      }

      const connections = medication.patient.family.calendarConnections;

      for (const connection of connections) {
        await this.syncMedicationToConnection(medication, connection);
      }

      logger.info('Medication synced to calendars', {
        medicationId,
        connectionsCount: connections.length,
      });
    } catch (error) {
      logger.error('Failed to sync medication', { error, medicationId });
      throw error;
    }
  }

  /**
   * Sync a care task to connected calendars
   */
  async syncCareTask(taskId: string): Promise<void> {
    try {
      const task = await prisma.careTask.findUnique({
        where: { id: taskId },
        include: {
          family: {
            include: {
              calendarConnections: {
                where: {
                  syncEnabled: true,
                  syncEventTypes: {
                    has: 'CARE_TASK',
                  },
                },
              },
            },
          },
          assignedTo: true,
        },
      });

      if (!task || task.status === 'CANCELLED') {
        logger.debug('Task not found or cancelled', { taskId });
        return;
      }

      const connections = task.family.calendarConnections;

      for (const connection of connections) {
        await this.syncCareTaskToConnection(task, connection);
      }

      logger.info('Care task synced to calendars', {
        taskId,
        connectionsCount: connections.length,
      });
    } catch (error) {
      logger.error('Failed to sync care task', { error, taskId });
      throw error;
    }
  }

  /**
   * Sync medication to a specific calendar connection
   */
  private async syncMedicationToConnection(medication: any, connection: any): Promise<void> {
    try {
      const accessToken = await googleOAuthService.getValidAccessToken(connection.id);

      if (connection.provider !== 'GOOGLE') {
        logger.warn('Only Google Calendar sync is currently supported', {
          provider: connection.provider,
        });
        return;
      }

      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Create recurring events for each scheduled time
      const startDate = new Date(medication.startDate);
      const endDate = medication.endDate ? new Date(medication.endDate) : null;

      for (const scheduleTime of medication.scheduleTime) {
        const [hours, minutes] = scheduleTime.split(':').map(Number);

        // Check if event already exists in sync log
        const existingSync = await prisma.calendarSyncLog.findFirst({
          where: {
            connectionId: connection.id,
            internalEventId: `${medication.id}-${scheduleTime}`,
            eventType: 'MEDICATION',
          },
          orderBy: { syncedAt: 'desc' },
        });

        const eventStart = new Date(startDate);
        eventStart.setHours(hours, minutes, 0, 0);

        const eventEnd = new Date(eventStart);
        eventEnd.setMinutes(eventEnd.getMinutes() + 30); // 30-minute duration

        const event = {
          summary: `💊 ${medication.name}`,
          description: `Medication: ${medication.name}\nDosage: ${medication.dosage}\n${medication.instructions || ''}`,
          start: {
            dateTime: eventStart.toISOString(),
            timeZone: 'America/New_York', // TODO: Make this configurable per family
          },
          end: {
            dateTime: eventEnd.toISOString(),
            timeZone: 'America/New_York',
          },
          recurrence: this.generateRecurrenceRule(medication.frequency, endDate),
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 30 },
              { method: 'popup', minutes: 10 },
            ],
          },
          colorId: '3', // Purple for medications
        };

        if (existingSync?.externalEventId) {
          // Update existing event
          try {
            await calendar.events.update({
              calendarId: connection.calendarId,
              eventId: existingSync.externalEventId,
              requestBody: event,
            });

            await this.logSync(
              connection.id,
              'MEDICATION',
              `${medication.id}-${scheduleTime}`,
              existingSync.externalEventId,
              'updated',
              'success'
            );
          } catch (error: any) {
            logger.error('Failed to update calendar event', { error, medicationId: medication.id });
            await this.logSync(
              connection.id,
              'MEDICATION',
              `${medication.id}-${scheduleTime}`,
              existingSync.externalEventId,
              'updated',
              'error',
              error.message
            );
          }
        } else {
          // Create new event
          try {
            const response = await calendar.events.insert({
              calendarId: connection.calendarId,
              requestBody: event,
            });

            await this.logSync(
              connection.id,
              'MEDICATION',
              `${medication.id}-${scheduleTime}`,
              response.data.id!,
              'created',
              'success'
            );
          } catch (error: any) {
            logger.error('Failed to create calendar event', { error, medicationId: medication.id });
            await this.logSync(
              connection.id,
              'MEDICATION',
              `${medication.id}-${scheduleTime}`,
              null,
              'created',
              'error',
              error.message
            );
          }
        }
      }
    } catch (error) {
      logger.error('Failed to sync medication to connection', {
        error,
        medicationId: medication.id,
        connectionId: connection.id,
      });
      throw error;
    }
  }

  /**
   * Sync care task to a specific calendar connection
   */
  private async syncCareTaskToConnection(task: any, connection: any): Promise<void> {
    try {
      const accessToken = await googleOAuthService.getValidAccessToken(connection.id);

      if (connection.provider !== 'GOOGLE') {
        logger.warn('Only Google Calendar sync is currently supported', {
          provider: connection.provider,
        });
        return;
      }

      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Check if event already exists in sync log
      const existingSync = await prisma.calendarSyncLog.findFirst({
        where: {
          connectionId: connection.id,
          internalEventId: task.id,
          eventType: 'CARE_TASK',
        },
        orderBy: { syncedAt: 'desc' },
      });

      // Only sync if task has a due date
      if (!task.dueDate) {
        logger.debug('Task has no due date, skipping sync', { taskId: task.id });
        return;
      }

      const dueDate = new Date(task.dueDate);
      const eventEnd = new Date(dueDate);
      eventEnd.setHours(eventEnd.getHours() + 1); // 1-hour duration

      // Determine icon based on task content/title
      let icon = '📋';
      const titleLower = task.title.toLowerCase();
      if (titleLower.includes('doctor') || titleLower.includes('appointment')) {
        icon = '🩺';
      } else if (titleLower.includes('exercise') || titleLower.includes('walk')) {
        icon = '🏃';
      } else if (titleLower.includes('meal') || titleLower.includes('food')) {
        icon = '🍽️';
      } else if (titleLower.includes('social') || titleLower.includes('visit')) {
        icon = '👥';
      }

      const event = {
        summary: `${icon} ${task.title}`,
        description: `${task.description || ''}\n\nPriority: ${task.priority}\nAssigned to: ${task.assignedTo?.firstName || 'Unassigned'}`,
        start: {
          dateTime: dueDate.toISOString(),
          timeZone: 'America/New_York',
        },
        end: {
          dateTime: eventEnd.toISOString(),
          timeZone: 'America/New_York',
        },
        recurrence: task.recurrenceRule
          ? [task.recurrenceRule]
          : undefined,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: task.priority === 'HIGH' ? 60 : 30 },
          ],
        },
        colorId: task.priority === 'HIGH' ? '11' : '2', // Red for high priority, green for others
      };

      if (existingSync?.externalEventId) {
        // Update existing event
        try {
          await calendar.events.update({
            calendarId: connection.calendarId,
            eventId: existingSync.externalEventId,
            requestBody: event,
          });

          await this.logSync(
            connection.id,
            'CARE_TASK',
            task.id,
            existingSync.externalEventId,
            'updated',
            'success'
          );
        } catch (error: any) {
          logger.error('Failed to update calendar event', { error, taskId: task.id });
          await this.logSync(
            connection.id,
            'CARE_TASK',
            task.id,
            existingSync.externalEventId,
            'updated',
            'error',
            error.message
          );
        }
      } else {
        // Create new event
        try {
          const response = await calendar.events.insert({
            calendarId: connection.calendarId,
            requestBody: event,
          });

          await this.logSync(
            connection.id,
            'CARE_TASK',
            task.id,
            response.data.id!,
            'created',
            'success'
          );
        } catch (error: any) {
          logger.error('Failed to create calendar event', { error, taskId: task.id });
          await this.logSync(
            connection.id,
            'CARE_TASK',
            task.id,
            null,
            'created',
            'error',
            error.message
          );
        }
      }
    } catch (error) {
      logger.error('Failed to sync care task to connection', {
        error,
        taskId: task.id,
        connectionId: connection.id,
      });
      throw error;
    }
  }

  /**
   * Delete event from external calendar
   */
  async deleteEvent(eventType: SyncEventType, internalEventId: string): Promise<void> {
    try {
      const syncLogs = await prisma.calendarSyncLog.findMany({
        where: {
          eventType,
          internalEventId,
        },
        include: {
          connection: true,
        },
        orderBy: { syncedAt: 'desc' },
      });

      for (const log of syncLogs) {
        if (!log.externalEventId || !log.connection.syncEnabled) {
          continue;
        }

        try {
          const accessToken = await googleOAuthService.getValidAccessToken(
            log.connection.id
          );

          const oauth2Client = new google.auth.OAuth2();
          oauth2Client.setCredentials({ access_token: accessToken });
          const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

          await calendar.events.delete({
            calendarId: log.connection.calendarId,
            eventId: log.externalEventId,
          });

          await this.logSync(
            log.connection.id,
            eventType,
            internalEventId,
            log.externalEventId,
            'deleted',
            'success'
          );
        } catch (error: any) {
          logger.error('Failed to delete calendar event', {
            error,
            eventId: log.externalEventId,
          });
          await this.logSync(
            log.connection.id,
            eventType,
            internalEventId,
            log.externalEventId,
            'deleted',
            'error',
            error.message
          );
        }
      }
    } catch (error) {
      logger.error('Failed to delete events', { error, eventType, internalEventId });
      throw error;
    }
  }

  /**
   * Generate recurrence rule for Google Calendar
   */
  private generateRecurrenceRule(frequency: string, endDate: Date | null): string[] | undefined {
    const freqLower = frequency.toLowerCase();

    let rule = 'RRULE:';

    if (freqLower.includes('daily')) {
      rule += 'FREQ=DAILY';
    } else if (freqLower.includes('weekly')) {
      rule += 'FREQ=WEEKLY';
    } else if (freqLower.includes('monthly')) {
      rule += 'FREQ=MONTHLY';
    } else {
      return undefined; // No recurrence for one-time events
    }

    if (endDate) {
      const untilDate = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      rule += `;UNTIL=${untilDate}`;
    }

    return [rule];
  }

  /**
   * Log sync operation
   */
  private async logSync(
    connectionId: string,
    eventType: SyncEventType,
    internalEventId: string,
    externalEventId: string | null,
    action: string,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    await prisma.calendarSyncLog.create({
      data: {
        connectionId,
        eventType,
        internalEventId,
        externalEventId,
        action,
        status,
        errorMessage,
      },
    });

    // Update connection's last sync status
    await prisma.calendarConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: status,
      },
    });
  }
}

export const calendarSyncService = new CalendarSyncService();
