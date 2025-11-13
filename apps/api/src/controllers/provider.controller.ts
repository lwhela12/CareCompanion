import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma, ProviderType } from '@carecompanion/database';
import { ApiError } from '../middleware/error';
import { ErrorCodes } from '@carecompanion/shared';
import { AuthRequest } from '../types';
import { logger } from '../utils/logger';

// Validation schemas
const createProviderSchema = z.object({
  name: z.string().min(1).max(100),
  specialty: z.string().max(100).optional(),
  type: z.enum([
    'PHYSICIAN',
    'SPECIALIST',
    'THERAPIST',
    'PHARMACIST',
    'FACILITY',
    'OTHER',
  ]).default('PHYSICIAN'),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  fax: z.string().max(20).optional(),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(2).optional(),
  zipCode: z.string().max(10).optional(),
  facility: z.string().max(200).optional(),
  department: z.string().max(100).optional(),
  isPrimary: z.boolean().default(false),
  notes: z.string().max(1000).optional(),
});

const updateProviderSchema = createProviderSchema.partial();

export class ProviderController {
  /**
   * Get all providers for family
   * Query params: type, isActive
   */
  async getProviders(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { type, isActive } = req.query;

    // Get user's family
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: { family: true },
        },
      },
    });

    if (!user || user.familyMembers.length === 0) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'No family found', 404);
    }

    const familyId = user.familyMembers[0].family.id;

    // Build filter
    const where: any = { familyId };

    if (type && typeof type === 'string') {
      where.type = type as ProviderType;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const providers = await prisma.provider.findMany({
      where,
      include: {
        _count: {
          select: {
            medications: true,
            recommendations: true,
            journalEntries: true,
          },
        },
      },
      orderBy: [
        { isPrimary: 'desc' },
        { name: 'asc' },
      ],
    });

    res.json({ providers });
  }

  /**
   * Get single provider by ID
   */
  async getProvider(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { id } = req.params;

    // Get user's family
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: { family: true },
        },
      },
    });

    if (!user || user.familyMembers.length === 0) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'No family found', 404);
    }

    const familyId = user.familyMembers[0].family.id;

    const provider = await prisma.provider.findFirst({
      where: {
        id,
        familyId,
      },
      include: {
        medications: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            dosage: true,
          },
        },
        recommendations: {
          where: { status: { not: 'DISMISSED' } },
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            priority: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        journalEntries: {
          select: {
            id: true,
            createdAt: true,
            visitDate: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            medications: true,
            recommendations: true,
            journalEntries: true,
          },
        },
      },
    });

    if (!provider) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Provider not found', 404);
    }

    res.json({ provider });
  }

  /**
   * Create provider manually
   */
  async createProvider(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;

    const validatedData = createProviderSchema.parse(req.body);

    // Get user's family
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: { family: true },
        },
      },
    });

    if (!user || user.familyMembers.length === 0) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'No family found', 404);
    }

    const familyId = user.familyMembers[0].family.id;

    // If this is being set as primary, unset other primary providers
    if (validatedData.isPrimary) {
      await prisma.provider.updateMany({
        where: {
          familyId,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    const { name, type, specialty, phone, email, fax, addressLine1, addressLine2, city, state, zipCode, facility, department, isPrimary, notes } = validatedData;

    const provider = await prisma.provider.create({
      data: {
        name,
        type,
        specialty,
        phone,
        email,
        fax,
        addressLine1,
        addressLine2,
        city,
        state,
        zipCode,
        facility,
        department,
        isPrimary,
        notes,
        family: {
          connect: { id: familyId },
        },
      },
    });

    logger.info(`Provider ${provider.id} created manually by user ${userId}`);

    res.status(201).json({ provider });
  }

  /**
   * Update provider
   */
  async updateProvider(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { id } = req.params;

    const validatedData = updateProviderSchema.parse(req.body);

    // Get user's family and verify access
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: { family: true },
        },
      },
    });

    if (!user || user.familyMembers.length === 0) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'No family found', 404);
    }

    const familyId = user.familyMembers[0].family.id;

    // Verify provider belongs to family
    const existing = await prisma.provider.findFirst({
      where: { id, familyId },
    });

    if (!existing) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Provider not found', 404);
    }

    // If this is being set as primary, unset other primary providers
    if (validatedData.isPrimary) {
      await prisma.provider.updateMany({
        where: {
          familyId,
          isPrimary: true,
          id: { not: id },
        },
        data: {
          isPrimary: false,
        },
      });
    }

    const updated = await prisma.provider.update({
      where: { id },
      data: validatedData,
    });

    res.json({ provider: updated });
  }

  /**
   * Set provider as primary
   */
  async setPrimaryProvider(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { id } = req.params;

    // Get user's family
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: { family: true },
        },
      },
    });

    if (!user || user.familyMembers.length === 0) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'No family found', 404);
    }

    const familyId = user.familyMembers[0].family.id;

    // Verify provider belongs to family
    const existing = await prisma.provider.findFirst({
      where: { id, familyId },
    });

    if (!existing) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Provider not found', 404);
    }

    // Unset other primary providers
    await prisma.provider.updateMany({
      where: {
        familyId,
        isPrimary: true,
      },
      data: {
        isPrimary: false,
      },
    });

    // Set this provider as primary
    const updated = await prisma.provider.update({
      where: { id },
      data: { isPrimary: true },
    });

    res.json({ provider: updated });
  }

  /**
   * Soft delete provider
   */
  async deleteProvider(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { id } = req.params;

    // Get user's family
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: { family: true },
        },
      },
    });

    if (!user || user.familyMembers.length === 0) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'No family found', 404);
    }

    const familyId = user.familyMembers[0].family.id;

    // Verify provider belongs to family
    const existing = await prisma.provider.findFirst({
      where: { id, familyId },
    });

    if (!existing) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Provider not found', 404);
    }

    // Soft delete (set isActive to false)
    const updated = await prisma.provider.update({
      where: { id },
      data: {
        isActive: false,
        isPrimary: false, // Can't be primary if inactive
      },
    });

    logger.info(`Provider ${id} soft deleted by user ${userId}`);

    res.json({ provider: updated });
  }
}

export const providerController = new ProviderController();
