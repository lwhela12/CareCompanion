import { Router } from 'express';
import { PrismaClient } from '@carecompanion/database';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authorize } from '../middleware/auth';
import { ApiError } from '../middleware/error';
import { ErrorCodes } from '@carecompanion/shared';

const router = Router();
const prisma = new PrismaClient();

// Get current family
router.get('/current', async (req, res, next) => {
  try {
    const family = await prisma.family.findUnique({
      where: { id: req.user!.familyId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            lastActive: true,
          },
        },
        patients: {
          select: {
            id: true,
            name: true,
            dateOfBirth: true,
          },
        },
        _count: {
          select: {
            journalEntries: true,
            careTasks: true,
            documents: true,
          },
        },
      },
    });

    res.json(family);
  } catch (error) {
    next(error);
  }
});

// Update family
const updateFamilySchema = z.object({
  name: z.string().min(1).max(255),
});

router.put(
  '/current',
  authorize('admin'),
  validate(updateFamilySchema),
  async (req, res, next) => {
    try {
      const family = await prisma.family.update({
        where: { id: req.user!.familyId },
        data: req.body,
      });

      res.json(family);
    } catch (error) {
      next(error);
    }
  }
);

// Invite user to family
const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(['care_coordinator', 'family_member', 'view_only']),
  name: z.string().min(1).max(255),
});

router.post(
  '/current/invite',
  authorize('admin', 'care_coordinator'),
  validate(inviteUserSchema),
  async (req, res, next) => {
    try {
      const { email, role, name } = req.body;

      // Check if user already exists in family
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          familyId: req.user!.familyId,
        },
      });

      if (existingUser) {
        throw new ApiError(
          ErrorCodes.ALREADY_EXISTS,
          'User already exists in this family',
          409
        );
      }

      // TODO: Send invitation email
      // For now, we'll just create a placeholder response
      res.json({
        message: 'Invitation sent',
        invitation: {
          email,
          role,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get family members
router.get('/current/members', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { familyId: req.user!.familyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        lastActive: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json(users);
  } catch (error) {
    next(error);
  }
});

// Remove family member
router.delete(
  '/current/members/:userId',
  authorize('admin'),
  async (req, res, next) => {
    try {
      const { userId } = req.params;

      // Prevent removing self
      if (userId === req.user!.id) {
        throw new ApiError(
          ErrorCodes.VALIDATION_ERROR,
          'Cannot remove yourself from the family',
          400
        );
      }

      // Check if user exists in family
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          familyId: req.user!.familyId,
        },
      });

      if (!user) {
        throw new ApiError(
          ErrorCodes.NOT_FOUND,
          'User not found in family',
          404
        );
      }

      // Delete user
      await prisma.user.delete({
        where: { id: userId },
      });

      res.json({ message: 'User removed from family' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;