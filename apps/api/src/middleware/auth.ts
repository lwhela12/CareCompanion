import { Request, Response, NextFunction } from 'express';
import { clerkClient, requireAuth } from '@clerk/express';
import { PrismaClient } from '@carecompanion/database';
import { ErrorCodes } from '@carecompanion/shared';
import { ApiError } from './error';

const prisma = new PrismaClient();

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        sessionId: string;
      };
      user?: {
        id: string;
        familyId: string;
        role: string;
        email: string;
        name: string;
      };
    }
  }
}

// Middleware to require authentication
export const authenticate = requireAuth();

// Middleware to load user data from database
export async function loadUser(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.userId) {
    return next(new ApiError(
      ErrorCodes.UNAUTHORIZED,
      'Authentication required',
      401
    ));
  }

  try {
    // Get user from Clerk
    const clerkUser = await clerkClient.users.getUser(req.auth.userId);
    
    // Find user in database
    const user = await prisma.user.findUnique({
      where: { authProviderId: clerkUser.id },
      include: { family: true },
    });

    if (!user) {
      return next(new ApiError(
        ErrorCodes.NOT_FOUND,
        'User not found',
        404
      ));
    }

    // Attach user to request
    req.user = {
      id: user.id,
      familyId: user.familyId,
      role: user.role,
      email: user.email,
      name: user.name,
    };

    next();
  } catch (error) {
    next(error);
  }
}

// Middleware to check user role
export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(
        ErrorCodes.UNAUTHORIZED,
        'User not loaded',
        401
      ));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(
        ErrorCodes.FORBIDDEN,
        'Insufficient permissions',
        403
      ));
    }

    next();
  };
}

// Middleware to check resource access
export function checkResourceAccess(
  resourceType: 'patient' | 'journalEntry' | 'medication' | 'careTask' | 'document'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(
        ErrorCodes.UNAUTHORIZED,
        'User not loaded',
        401
      ));
    }

    const resourceId = req.params.id;
    if (!resourceId) {
      return next();
    }

    try {
      let hasAccess = false;

      switch (resourceType) {
        case 'patient':
          const patient = await prisma.patient.findFirst({
            where: {
              id: resourceId,
              familyId: req.user.familyId,
            },
          });
          hasAccess = !!patient;
          break;

        case 'journalEntry':
          const journalEntry = await prisma.journalEntry.findFirst({
            where: {
              id: resourceId,
              familyId: req.user.familyId,
            },
          });
          hasAccess = !!journalEntry;
          break;

        case 'medication':
          const medication = await prisma.medication.findFirst({
            where: {
              id: resourceId,
              patient: {
                familyId: req.user.familyId,
              },
            },
          });
          hasAccess = !!medication;
          break;

        case 'careTask':
          const careTask = await prisma.careTask.findFirst({
            where: {
              id: resourceId,
              familyId: req.user.familyId,
            },
          });
          hasAccess = !!careTask;
          break;

        case 'document':
          const document = await prisma.document.findFirst({
            where: {
              id: resourceId,
              familyId: req.user.familyId,
            },
          });
          hasAccess = !!document;
          break;
      }

      if (!hasAccess) {
        return next(new ApiError(
          ErrorCodes.FORBIDDEN,
          'Access denied to this resource',
          403
        ));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}