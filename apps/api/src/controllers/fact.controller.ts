import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@carecompanion/database';
import { ApiError } from '../middleware/error';
import { ErrorCodes } from '@carecompanion/shared';
import { AuthRequest } from '../types';
import { buildFactsHeader } from '../services/factsHeader.service';

const listSchema = z.object({
  status: z.string().optional(),
  domain: z.string().optional(),
  entityType: z.string().optional(),
  q: z.string().optional(),
  pinned: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
});

const patchSchema = z.object({
  status: z.enum(['PROPOSED', 'ACTIVE', 'REJECTED', 'SUPERSEDED']).optional(),
  pinned: z.boolean().optional(),
  value: z.any().optional(),
  effectiveStart: z.string().datetime().optional(),
  effectiveEnd: z.string().datetime().optional(),
});

const createSchema = z.object({
  entityId: z.string().uuid(),
  domain: z.enum(['MEDICAL','FINANCIAL','ESTATE','WELLBEING']),
  entityType: z.string(),
  key: z.string().min(1),
  value: z.any(),
  pinned: z.boolean().optional().default(false),
  effectiveStart: z.string().datetime().optional(),
  effectiveEnd: z.string().datetime().optional(),
});

export class FactController {
  async list(req: AuthRequest, res: Response) {
    if (!req.auth?.userId) throw new ApiError(ErrorCodes.UNAUTHORIZED, 'Auth required', 401);

    const user = await prisma.user.findUnique({ where: { clerkId: req.auth.userId }, include: { familyMembers: { where: { isActive: true } } } });
    if (!user || user.familyMembers.length === 0) throw new ApiError(ErrorCodes.FAMILY_NOT_FOUND, 'No family found', 404);
    const familyId = user.familyMembers[0].familyId;

    const qp = listSchema.parse(req.query);
    const where: any = { familyId };
    if (qp.status) where.status = qp.status as any;
    if (qp.domain) where.domain = qp.domain as any;
    if (qp.entityType) where.entityType = qp.entityType;
    if (qp.pinned) where.pinned = qp.pinned === 'true';
    if (qp.q) where.OR = [
      { key: { contains: qp.q, mode: 'insensitive' } },
      { entity: { displayName: { contains: qp.q, mode: 'insensitive' } } },
    ];

    const [items, total] = await Promise.all([
      prisma.fact.findMany({
        where,
        include: { entity: true, sources: true },
        orderBy: { updatedAt: 'desc' },
        take: qp.limit,
        skip: qp.offset,
      }),
      prisma.fact.count({ where }),
    ]);

    res.json({ facts: items, total });
  }

  async get(req: AuthRequest, res: Response) {
    if (!req.auth?.userId) throw new ApiError(ErrorCodes.UNAUTHORIZED, 'Auth required', 401);
    const { factId } = req.params;
    const fact = await prisma.fact.findUnique({ where: { id: factId }, include: { entity: true, sources: true } });
    if (!fact) throw new ApiError(ErrorCodes.NOT_FOUND, 'Fact not found', 404);
    res.json({ fact });
  }

  async patch(req: AuthRequest, res: Response) {
    if (!req.auth?.userId) throw new ApiError(ErrorCodes.UNAUTHORIZED, 'Auth required', 401);
    const { factId } = req.params;
    const body = patchSchema.parse(req.body);
    const updated = await prisma.fact.update({
      where: { id: factId },
      data: {
        status: body.status as any,
        pinned: body.pinned,
        value: body.value as any,
        effectiveStart: body.effectiveStart ? new Date(body.effectiveStart) : undefined,
        effectiveEnd: body.effectiveEnd ? new Date(body.effectiveEnd) : undefined,
        assertedBy: 'USER' as any,
      },
      include: { entity: true, sources: true },
    });
    res.json({ fact: updated });
  }

  async create(req: AuthRequest, res: Response) {
    if (!req.auth?.userId) throw new ApiError(ErrorCodes.UNAUTHORIZED, 'Auth required', 401);
    const user = await prisma.user.findUnique({ where: { clerkId: req.auth.userId }, include: { familyMembers: { where: { isActive: true } } } });
    if (!user || user.familyMembers.length === 0) throw new ApiError(ErrorCodes.FAMILY_NOT_FOUND, 'No family found', 404);
    const familyId = user.familyMembers[0].familyId;
    const body = createSchema.parse(req.body);
    const fact = await prisma.fact.create({
      data: {
        familyId,
        entityId: body.entityId,
        domain: body.domain as any,
        entityType: body.entityType,
        key: body.key,
        value: body.value as any,
        status: 'ACTIVE',
        assertedBy: 'USER',
        pinned: body.pinned,
        effectiveStart: body.effectiveStart ? new Date(body.effectiveStart) : undefined,
        effectiveEnd: body.effectiveEnd ? new Date(body.effectiveEnd) : undefined,
      },
      include: { entity: true, sources: true },
    });
    res.status(201).json({ fact });
  }

  async header(req: AuthRequest, res: Response) {
    if (!req.auth?.userId) throw new ApiError(ErrorCodes.UNAUTHORIZED, 'Auth required', 401);

    const user = await prisma.user.findUnique({ where: { clerkId: req.auth.userId }, include: { familyMembers: { where: { isActive: true } } } });
    if (!user || user.familyMembers.length === 0) throw new ApiError(ErrorCodes.FAMILY_NOT_FOUND, 'No family found', 404);
    const familyId = user.familyMembers[0].familyId;

    const header = await buildFactsHeader(familyId);
    res.json({ header });
  }
}

export const factController = new FactController();
