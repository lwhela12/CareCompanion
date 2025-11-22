import { prisma } from '@carecompanion/database';
import { Request } from 'express';
import { AuthRequest } from '../types';
import { logger } from '../utils/logger';

// Standard audit actions for compliance tracking
export const AuditActions = {
  // Authentication & Access
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  IMPERSONATE_START: 'IMPERSONATE_START',
  IMPERSONATE_END: 'IMPERSONATE_END',
  PASSWORD_RESET: 'PASSWORD_RESET',

  // Data Access (READ operations)
  VIEW_PATIENT: 'VIEW_PATIENT',
  VIEW_MEDICATION: 'VIEW_MEDICATION',
  VIEW_DOCUMENT: 'VIEW_DOCUMENT',
  VIEW_JOURNAL: 'VIEW_JOURNAL',
  VIEW_CARE_TASK: 'VIEW_CARE_TASK',
  VIEW_FAMILY: 'VIEW_FAMILY',
  DOWNLOAD_DOCUMENT: 'DOWNLOAD_DOCUMENT',
  EXPORT_DATA: 'EXPORT_DATA',

  // Data Modifications (WRITE operations)
  CREATE_PATIENT: 'CREATE_PATIENT',
  UPDATE_PATIENT: 'UPDATE_PATIENT',
  DELETE_PATIENT: 'DELETE_PATIENT',

  CREATE_MEDICATION: 'CREATE_MEDICATION',
  UPDATE_MEDICATION: 'UPDATE_MEDICATION',
  DELETE_MEDICATION: 'DELETE_MEDICATION',
  LOG_MEDICATION: 'LOG_MEDICATION',

  CREATE_DOCUMENT: 'CREATE_DOCUMENT',
  UPDATE_DOCUMENT: 'UPDATE_DOCUMENT',
  DELETE_DOCUMENT: 'DELETE_DOCUMENT',

  CREATE_JOURNAL: 'CREATE_JOURNAL',
  UPDATE_JOURNAL: 'UPDATE_JOURNAL',
  DELETE_JOURNAL: 'DELETE_JOURNAL',

  CREATE_CARE_TASK: 'CREATE_CARE_TASK',
  UPDATE_CARE_TASK: 'UPDATE_CARE_TASK',
  DELETE_CARE_TASK: 'DELETE_CARE_TASK',
  COMPLETE_CARE_TASK: 'COMPLETE_CARE_TASK',

  // Family & Member Management
  CREATE_FAMILY: 'CREATE_FAMILY',
  UPDATE_FAMILY: 'UPDATE_FAMILY',
  INVITE_MEMBER: 'INVITE_MEMBER',
  ACCEPT_INVITATION: 'ACCEPT_INVITATION',
  REMOVE_MEMBER: 'REMOVE_MEMBER',
  UPDATE_MEMBER_ROLE: 'UPDATE_MEMBER_ROLE',

  // Settings & Preferences
  UPDATE_NOTIFICATION_PREFS: 'UPDATE_NOTIFICATION_PREFS',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
} as const;

export type AuditAction = typeof AuditActions[keyof typeof AuditActions];

// Resource types for categorization
export const ResourceTypes = {
  USER: 'user',
  PATIENT: 'patient',
  FAMILY: 'family',
  FAMILY_MEMBER: 'family_member',
  MEDICATION: 'medication',
  MEDICATION_LOG: 'medication_log',
  DOCUMENT: 'document',
  JOURNAL: 'journal',
  CARE_TASK: 'care_task',
  INVITATION: 'invitation',
  SETTINGS: 'settings',
} as const;

export type ResourceType = typeof ResourceTypes[keyof typeof ResourceTypes];

interface AuditLogParams {
  familyId: string;
  userId: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  impersonatedBy?: string;
}

interface AuditLogFromRequestParams {
  req: AuthRequest;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  metadata?: Record<string, any>;
  familyId?: string; // Optional override if not in standard location
  userId?: string; // Internal user ID override
}

class AuditService {
  /**
   * Create an audit log entry directly with all parameters
   */
  async log(params: AuditLogParams): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          familyId: params.familyId,
          userId: params.userId,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId,
          metadata: params.metadata,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          impersonatedBy: params.impersonatedBy,
        },
      });
    } catch (error) {
      // Log error but don't throw - audit logging should never break the main flow
      logger.error('Failed to create audit log:', {
        error,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
      });
    }
  }

  /**
   * Create an audit log entry from an Express request
   * Automatically extracts IP, user agent, and user info
   */
  async logFromRequest(params: AuditLogFromRequestParams): Promise<void> {
    const { req, action, resourceType, resourceId, metadata, familyId, userId } = params;

    // Get user info from request
    const clerkId = req.auth?.userId;
    if (!clerkId && !userId) {
      logger.warn('Audit log attempted without authenticated user', {
        action,
        resourceType,
        resourceId,
      });
      return;
    }

    try {
      // Look up internal user ID if not provided
      let internalUserId = userId;
      let userFamilyId = familyId;

      if (!internalUserId && clerkId) {
        const user = await prisma.user.findUnique({
          where: { clerkId },
          include: {
            familyMembers: {
              where: { isActive: true },
              take: 1,
            },
          },
        });

        if (!user) {
          logger.warn('Audit log: User not found', { clerkId, action });
          return;
        }

        internalUserId = user.id;

        // Get family ID from user if not provided
        if (!userFamilyId && user.familyMembers.length > 0) {
          userFamilyId = user.familyMembers[0].familyId;
        }
      }

      if (!userFamilyId || !internalUserId) {
        logger.warn('Audit log: Missing familyId or userId', {
          action,
          resourceType,
          familyId: userFamilyId,
          userId: internalUserId,
        });
        return;
      }

      await this.log({
        familyId: userFamilyId,
        userId: internalUserId,
        action,
        resourceType,
        resourceId,
        metadata,
        ipAddress: this.getClientIp(req),
        userAgent: req.get('user-agent'),
      });
    } catch (error) {
      logger.error('Failed to create audit log from request:', {
        error,
        action,
        resourceType,
        resourceId,
      });
    }
  }

  /**
   * Query audit logs for a family with pagination
   */
  async getAuditLogs(
    familyId: string,
    options: {
      limit?: number;
      offset?: number;
      action?: AuditAction;
      resourceType?: ResourceType;
      resourceId?: string;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ) {
    const {
      limit = 50,
      offset = 0,
      action,
      resourceType,
      resourceId,
      userId,
      startDate,
      endDate,
    } = options;

    const where: any = { familyId };

    if (action) where.action = action;
    if (resourceType) where.resourceType = resourceType;
    if (resourceId) where.resourceId = resourceId;
    if (userId) where.userId = userId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          impersonator: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      limit,
      offset,
      hasMore: offset + logs.length < total,
    };
  }

  /**
   * Get recent activity summary for dashboard
   */
  async getRecentActivitySummary(familyId: string, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await prisma.auditLog.groupBy({
      by: ['action'],
      where: {
        familyId,
        createdAt: { gte: startDate },
      },
      _count: { action: true },
    });

    return logs.map(log => ({
      action: log.action,
      count: log._count.action,
    }));
  }

  /**
   * Get client IP address from request
   */
  private getClientIp(req: Request): string | undefined {
    // Check various headers for proxied requests
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0];
      return ips.trim();
    }

    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    return req.ip;
  }
}

export const auditService = new AuditService();
