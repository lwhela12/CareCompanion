import { Request, Response } from 'express';
import { prisma, CalendarProvider, SyncEventType } from '@carecompanion/database';
import { googleOAuthService } from '../services/calendar/googleOAuth.service';
import { calendarSyncService } from '../services/calendar/calendarSync.service';
import { logger } from '../utils/logger';

/**
 * Calendar Controller
 * Handles API requests for calendar integration
 */
class CalendarController {
  /**
   * Initiate OAuth flow for Google Calendar
   * GET /api/v1/calendar/auth/google
   */
  async initiateGoogleAuth(req: Request, res: Response): Promise<void> {
    try {
      const { userId, familyId } = req.user as any;

      if (!userId || !familyId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const authUrl = googleOAuthService.getAuthorizationUrl(userId, familyId);

      res.json({ authUrl });
    } catch (error) {
      logger.error('Failed to initiate Google OAuth', { error });
      res.status(500).json({ error: 'Failed to initiate authentication' });
    }
  }

  /**
   * Handle OAuth callback from Google
   * GET /api/v1/calendar/callback/google
   */
  async handleGoogleCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state } = req.query;

      if (!code || typeof code !== 'string') {
        res.status(400).json({ error: 'Missing authorization code' });
        return;
      }

      if (!state || typeof state !== 'string') {
        res.status(400).json({ error: 'Missing state parameter' });
        return;
      }

      // Decrypt state to get user/family info
      const { userId, familyId } = googleOAuthService.decryptState(state);

      // Exchange code for tokens
      const { accessToken, refreshToken, expiresAt } =
        await googleOAuthService.exchangeCodeForTokens(code);

      // Get user's calendar list
      const calendars = await googleOAuthService.getUserCalendars(accessToken);

      // Use primary calendar or first available
      const primaryCalendar = calendars.find(cal => cal.primary) || calendars[0];

      if (!primaryCalendar) {
        res.status(400).json({ error: 'No calendars found' });
        return;
      }

      // Create calendar connection (encrypting tokens)
      const connection = await prisma.calendarConnection.create({
        data: {
          userId,
          familyId,
          provider: CalendarProvider.GOOGLE,
          accessToken: this.encryptToken(accessToken),
          refreshToken: refreshToken ? this.encryptToken(refreshToken) : null,
          expiresAt,
          calendarId: primaryCalendar.id,
          calendarName: primaryCalendar.name,
          syncEnabled: true,
          syncEventTypes: ['MEDICATION', 'CARE_TASK', 'APPOINTMENT'], // Sync all by default
        },
      });

      logger.info('Calendar connection created', {
        connectionId: connection.id,
        userId,
        familyId,
      });

      // Redirect to frontend with success
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/settings/calendar?success=true`);
    } catch (error) {
      logger.error('Failed to handle Google callback', { error });
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/settings/calendar?error=auth_failed`);
    }
  }

  /**
   * Get all calendar connections for the current user/family
   * GET /api/v1/calendar/connections
   */
  async getConnections(req: Request, res: Response): Promise<void> {
    try {
      const { userId, familyId } = req.user as any;

      const connections = await prisma.calendarConnection.findMany({
        where: {
          OR: [
            { userId, familyId },
            { userId: null, familyId }, // Family-wide connections
          ],
        },
        select: {
          id: true,
          provider: true,
          calendarName: true,
          syncEnabled: true,
          syncEventTypes: true,
          lastSyncAt: true,
          lastSyncStatus: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ connections });
    } catch (error) {
      logger.error('Failed to get calendar connections', { error });
      res.status(500).json({ error: 'Failed to fetch calendar connections' });
    }
  }

  /**
   * Update calendar connection settings
   * PUT /api/v1/calendar/connections/:connectionId
   */
  async updateConnection(req: Request, res: Response): Promise<void> {
    try {
      const { connectionId } = req.params;
      const { syncEnabled, syncEventTypes } = req.body;
      const { userId } = req.user as any;

      // Verify ownership
      const connection = await prisma.calendarConnection.findUnique({
        where: { id: connectionId },
      });

      if (!connection) {
        res.status(404).json({ error: 'Connection not found' });
        return;
      }

      if (connection.userId !== userId && connection.userId !== null) {
        res.status(403).json({ error: 'Not authorized to modify this connection' });
        return;
      }

      // Update connection
      const updated = await prisma.calendarConnection.update({
        where: { id: connectionId },
        data: {
          syncEnabled:
            syncEnabled !== undefined ? syncEnabled : connection.syncEnabled,
          syncEventTypes:
            syncEventTypes !== undefined
              ? syncEventTypes
              : connection.syncEventTypes,
        },
      });

      res.json({ connection: updated });
    } catch (error) {
      logger.error('Failed to update calendar connection', { error });
      res.status(500).json({ error: 'Failed to update connection' });
    }
  }

  /**
   * Delete/disconnect a calendar connection
   * DELETE /api/v1/calendar/connections/:connectionId
   */
  async deleteConnection(req: Request, res: Response): Promise<void> {
    try {
      const { connectionId } = req.params;
      const { userId } = req.user as any;

      // Verify ownership
      const connection = await prisma.calendarConnection.findUnique({
        where: { id: connectionId },
      });

      if (!connection) {
        res.status(404).json({ error: 'Connection not found' });
        return;
      }

      if (connection.userId !== userId && connection.userId !== null) {
        res.status(403).json({ error: 'Not authorized to delete this connection' });
        return;
      }

      // Delete connection (this will also delete associated sync logs via cascade)
      await prisma.calendarConnection.delete({
        where: { id: connectionId },
      });

      logger.info('Calendar connection deleted', { connectionId, userId });

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete calendar connection', { error });
      res.status(500).json({ error: 'Failed to delete connection' });
    }
  }

  /**
   * Manually trigger sync for a specific connection
   * POST /api/v1/calendar/connections/:connectionId/sync
   */
  async manualSync(req: Request, res: Response): Promise<void> {
    try {
      const { connectionId } = req.params;
      const { userId } = req.user as any;

      // Verify ownership
      const connection = await prisma.calendarConnection.findUnique({
        where: { id: connectionId },
        include: {
          family: {
            include: {
              patient: {
                include: {
                  medications: {
                    where: { isActive: true },
                  },
                },
              },
              careTasks: {
                where: {
                  status: { not: 'CANCELLED' },
                },
              },
            },
          },
        },
      });

      if (!connection) {
        res.status(404).json({ error: 'Connection not found' });
        return;
      }

      if (connection.userId !== userId && connection.userId !== null) {
        res.status(403).json({ error: 'Not authorized to sync this connection' });
        return;
      }

      // Sync medications if enabled
      if (connection.syncEventTypes.includes('MEDICATION')) {
        const medications = connection.family.patient?.medications || [];
        for (const medication of medications) {
          await calendarSyncService.syncMedication(medication.id);
        }
      }

      // Sync care tasks if enabled
      if (connection.syncEventTypes.includes('CARE_TASK')) {
        const tasks = connection.family.careTasks;
        for (const task of tasks) {
          await calendarSyncService.syncCareTask(task.id);
        }
      }

      res.json({ success: true, message: 'Sync completed' });
    } catch (error) {
      logger.error('Failed to manually sync calendar', { error });
      res.status(500).json({ error: 'Failed to sync calendar' });
    }
  }

  /**
   * Get sync logs for a connection
   * GET /api/v1/calendar/connections/:connectionId/logs
   */
  async getSyncLogs(req: Request, res: Response): Promise<void> {
    try {
      const { connectionId } = req.params;
      const { limit = '50' } = req.query;

      const logs = await prisma.calendarSyncLog.findMany({
        where: { connectionId },
        orderBy: { syncedAt: 'desc' },
        take: parseInt(limit as string, 10),
      });

      res.json({ logs });
    } catch (error) {
      logger.error('Failed to get sync logs', { error });
      res.status(500).json({ error: 'Failed to fetch sync logs' });
    }
  }

  /**
   * Helper: Encrypt token (using same logic as OAuth service)
   * TODO: Consider moving to shared utility
   */
  private encryptToken(token: string): string {
    const crypto = require('crypto');
    const cipher = crypto.createCipher('aes-256-cbc', process.env.GOOGLE_TOKEN_SECRET || 'default-token-secret');
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }
}

export const calendarController = new CalendarController();
