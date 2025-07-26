import { Request, Response, NextFunction } from 'express';
import { clerkClient } from '@clerk/express';
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
        familyId?: string;
        role?: string;
        email: string;
        name: string;
      };
    }
  }
}

// Middleware to require authentication
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  if (!req.auth || !req.auth.userId) {
    return res.status(401).json({
      error: {
        code: ErrorCodes.UNAUTHORIZED,
        message: 'Authentication required',
      },
    });
  }
  next();
}

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
    // Find user in database using clerkId
    const user = await prisma.user.findUnique({
      where: { clerkId: req.auth.userId },
      include: { 
        familyMembers: {
          where: { isActive: true },
          include: {
            family: true
          }
        }
      },
    });

    // User might not exist yet (new user who hasn't onboarded)
    if (!user) {
      // For new users, we'll let them through to create their family
      next();
      return;
    }

    // If user has family memberships, attach the first active one
    // In the future, we might want to handle multiple families
    if (user.familyMembers.length > 0) {
      const familyMember = user.familyMembers[0];
      req.user = {
        id: user.id,
        familyId: familyMember.familyId,
        role: familyMember.role,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
      };
    }

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