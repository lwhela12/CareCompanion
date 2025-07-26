import { Router } from 'express';
import { clerkClient } from '@clerk/express';
import { PrismaClient } from '@carecompanion/database';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { ApiError } from '../middleware/error';
import { ErrorCodes } from '@carecompanion/shared';

const router = Router();
const prisma = new PrismaClient();

// Register new user (after Clerk signup)
const registerSchema = z.object({
  clerkUserId: z.string(),
  familyName: z.string().min(1).max(255),
  inviteCode: z.string().optional(),
});

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { clerkUserId, familyName, inviteCode } = req.body;

    // Get user details from Clerk
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { authProviderId: clerkUserId },
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
      // TODO: Implement invite code logic
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
        authProviderId: clerkUserId,
        email: clerkUser.emailAddresses[0].emailAddress,
        name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User',
        familyId,
        role: role as any,
      },
      include: {
        family: true,
      },
    });

    res.json({
      user,
      isNewUser: true,
    });
  } catch (error) {
    next(error);
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
      where: { authProviderId: req.auth.userId },
      include: {
        family: true,
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

    res.json({ user });
  } catch (error) {
    res.status(500).json({
      error: {
        code: ErrorCodes.DATABASE_ERROR,
        message: 'Failed to fetch user',
      },
    });
  }
});

export default router;