import { google } from 'googleapis';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { prisma } from '@carecompanion/database';
import crypto from 'crypto';

/**
 * Google OAuth Service for Calendar Integration
 * Handles OAuth 2.0 flow for connecting user calendars
 */
class GoogleOAuthService {
  private oauth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );
  }

  /**
   * Generate authorization URL for Google OAuth flow
   */
  getAuthorizationUrl(userId: string, familyId: string): string {
    const state = this.encryptState({ userId, familyId });

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Request refresh token
      scope: [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly',
      ],
      state,
      prompt: 'consent', // Force consent screen to get refresh token
    });

    logger.info('Generated Google OAuth authorization URL', { userId, familyId });
    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);

      const expiresAt = tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : undefined;

      logger.info('Successfully exchanged code for tokens', {
        hasRefreshToken: !!tokens.refresh_token,
        expiresAt,
      });

      return {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token,
        expiresAt,
      };
    } catch (error) {
      logger.error('Failed to exchange code for tokens', { error });
      throw new Error('Failed to authenticate with Google Calendar');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresAt?: Date;
  }> {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      const expiresAt = credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : undefined;

      logger.info('Successfully refreshed access token', { expiresAt });

      return {
        accessToken: credentials.access_token!,
        expiresAt,
      };
    } catch (error) {
      logger.error('Failed to refresh access token', { error });
      throw new Error('Failed to refresh Google Calendar access token');
    }
  }

  /**
   * Get a valid access token for a connection, refreshing if necessary
   */
  async getValidAccessToken(connectionId: string): Promise<string> {
    const connection = await prisma.calendarConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new Error('Calendar connection not found');
    }

    // Decrypt tokens
    const accessToken = this.decryptToken(connection.accessToken);
    const refreshToken = connection.refreshToken
      ? this.decryptToken(connection.refreshToken)
      : null;

    // Check if token is expired (with 5-minute buffer)
    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    const isExpired = connection.expiresAt &&
      connection.expiresAt.getTime() - bufferTime < now.getTime();

    if (!isExpired) {
      return accessToken;
    }

    // Token expired, try to refresh
    if (!refreshToken) {
      throw new Error('Access token expired and no refresh token available');
    }

    const { accessToken: newAccessToken, expiresAt } =
      await this.refreshAccessToken(refreshToken);

    // Update stored token
    await prisma.calendarConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: this.encryptToken(newAccessToken),
        expiresAt,
        updatedAt: new Date(),
      },
    });

    return newAccessToken;
  }

  /**
   * Get user's calendar list from Google
   */
  async getUserCalendars(accessToken: string) {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      const response = await calendar.calendarList.list();

      return response.data.items?.map(cal => ({
        id: cal.id!,
        name: cal.summary!,
        primary: cal.primary || false,
        accessRole: cal.accessRole!,
      })) || [];
    } catch (error) {
      logger.error('Failed to fetch user calendars', { error });
      throw new Error('Failed to fetch Google calendars');
    }
  }

  /**
   * Encrypt state parameter for OAuth flow
   */
  private encryptState(data: { userId: string; familyId: string }): string {
    const json = JSON.stringify(data);
    const cipher = crypto.createCipher('aes-256-cbc', config.google.stateSecret);
    let encrypted = cipher.update(json, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Decrypt state parameter from OAuth callback
   */
  decryptState(encrypted: string): { userId: string; familyId: string } {
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', config.google.stateSecret);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (error) {
      logger.error('Failed to decrypt state parameter', { error });
      throw new Error('Invalid state parameter');
    }
  }

  /**
   * Encrypt token for storage
   */
  private encryptToken(token: string): string {
    const cipher = crypto.createCipher('aes-256-cbc', config.google.tokenSecret);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Decrypt token from storage
   */
  private decryptToken(encrypted: string): string {
    const decipher = crypto.createDecipher('aes-256-cbc', config.google.tokenSecret);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

export const googleOAuthService = new GoogleOAuthService();
