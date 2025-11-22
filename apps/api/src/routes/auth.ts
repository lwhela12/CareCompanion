import { Router } from 'express';
import { clerkClient } from '@clerk/express';
import { PrismaClient } from '@carecompanion/database';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { ApiError } from '../middleware/error';
import { ErrorCodes } from '@carecompanion/shared';
import { authenticate } from '../middleware/auth';
import { authController } from '../controllers/auth.controller';
import { authRateLimiter } from '../middleware/rateLimit';

const router = Router();
const prisma = new PrismaClient();

// Register new user (after Clerk signup)
const registerSchema = z.object({
  clerkUserId: z.string(),
  familyName: z.string().min(1).max(255),
  inviteCode: z.string().optional(),
});

router.post('/register', authRateLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { clerkUserId, familyName, inviteCode } = req.body;

    // Get user details from Clerk
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    if (existingUser) {
      return res.json({
        user: existingUser,
        isNewUser: false,
      });
    }

    // Handle invite code if provided
    let familyId: string;
    let role: string = 'admin';

    if (inviteCode) {
      // Invite code flow is handled via /invitation/:token endpoint in family routes
      throw new ApiError(
        ErrorCodes.NOT_FOUND,
        'Invalid invite code',
        404
      );
    } else {
      // Create new family
      const family = await prisma.family.create({
        data: {
          name: familyName,
        },
      });
      familyId = family.id;
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        clerkId: clerkUserId,
        email: clerkUser.emailAddresses[0].emailAddress,
        firstName: clerkUser.firstName || '',
        lastName: clerkUser.lastName || '',
      },
      include: {
        familyMembers: {
          include: {
            family: true,
          },
        },
      },
    });

    return res.json({
      user,
      isNewUser: true,
    });
  } catch (error) {
    return next(error);
  }
});

// Get current user
router.get('/me', async (req, res) => {
  if (!req.auth?.userId) {
    return res.status(401).json({
      error: {
        code: ErrorCodes.UNAUTHORIZED,
        message: 'Not authenticated',
      },
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: req.auth.userId },
      include: {
        familyMembers: {
          include: {
            family: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        error: {
          code: ErrorCodes.NOT_FOUND,
          message: 'User not found',
        },
      });
    }

    return res.json({ user });
  } catch (error) {
    return res.status(500).json({
      error: {
        code: ErrorCodes.DATABASE_ERROR,
        message: 'Failed to fetch user',
      },
    });
  }
});

// Impersonate patient (caregiver logs in as patient)
router.post('/impersonate', authenticate, async (req, res, next) => {
  try {
    await authController.impersonatePatient(req, res);
  } catch (error) {
    next(error);
  }
});

// Exit impersonation
router.post('/exit-impersonation', authenticate, async (req, res, next) => {
  try {
    await authController.exitImpersonation(req, res);
  } catch (error) {
    next(error);
  }
});

// Reset patient password (caregiver only)
router.post('/reset-patient-password', authenticate, async (req, res, next) => {
  try {
    await authController.resetPatientPassword(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;