import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma, ChecklistCategory } from '@carecompanion/database';
import { ApiError } from '../middleware/error';
import { ErrorCodes } from '@carecompanion/shared';
import { AuthRequest } from '../types';
import { startOfDay, endOfDay } from 'date-fns';

// Validation schemas
const createChecklistItemSchema = z.object({
  patientId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  category: z.enum(['MEALS', 'MEDICATION', 'EXERCISE', 'HYGIENE', 'SOCIAL', 'THERAPY', 'OTHER']),
  scheduledTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
});

const logChecklistItemSchema = z.object({
  notes: z.string().max(1000).optional(),
  voiceNoteUrl: z.string().url().optional(),
});

export class PatientController {
  // Get today's checklist for a patient (simplified view for patient portal)
  async getTodaysChecklist(req: AuthRequest, res: Response) {
    const { patientId } = req.params;
    const userId = req.auth!.userId;

    // Verify user has access to the patient
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: {
            family: {
              include: {
                patient: {
                  where: { id: patientId },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.familyMembers.some(fm => fm.family.patient?.id === patientId)) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Access denied to this patient', 403);
    }

    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    // Get active checklist items
    const checklistItems = await prisma.patientChecklistItem.findMany({
      where: {
        patientId,
        isActive: true,
      },
      include: {
        logs: {
          where: {
            completedAt: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
          orderBy: {
            completedAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: [
        { category: 'asc' },
        { title: 'asc' },
      ],
    });

    // Get today's medications
    const medications = await prisma.medication.findMany({
      where: {
        patientId,
        isActive: true,
        startDate: { lte: todayEnd },
        OR: [
          { endDate: null },
          { endDate: { gte: todayStart } },
        ],
      },
      include: {
        logs: {
          where: {
            scheduledTime: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
        },
      },
    });

    // Build medication schedule
    const medicationSchedule = [];
    for (const med of medications) {
      for (const time of med.scheduleTime) {
        const [hours, minutes] = time.split(':').map(Number);
        const scheduledTime = new Date(today);
        scheduledTime.setHours(hours, minutes, 0, 0);

        const log = med.logs.find(
          l => l.scheduledTime.getTime() === scheduledTime.getTime()
        );

        medicationSchedule.push({
          id: `med-${med.id}-${time}`,
          medicationId: med.id,
          type: 'medication',
          category: 'MEDICATION',
          title: med.name,
          description: med.dosage,
          time,
          scheduledTime: scheduledTime.toISOString(),
          completed: log?.status === 'GIVEN',
          status: log?.status?.toLowerCase() || 'pending',
        });
      }
    }

    // Format checklist items
    const checklist = checklistItems.map(item => ({
      id: item.id,
      type: 'checklist',
      category: item.category,
      title: item.title,
      description: item.description,
      time: item.scheduledTime,
      completed: item.logs.length > 0,
      completedAt: item.logs[0]?.completedAt,
      notes: item.logs[0]?.notes,
      voiceNoteUrl: item.logs[0]?.voiceNoteUrl,
    }));

    res.json({
      date: today.toISOString(),
      medications: medicationSchedule.sort((a, b) => a.time.localeCompare(b.time)),
      checklist,
    });
  }

  // Log checklist item completion
  async logChecklistItem(req: AuthRequest, res: Response) {
    const { itemId } = req.params;
    const validation = logChecklistItemSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid input', 400, validation.error.errors);
    }

    const userId = req.auth!.userId;
    const { notes, voiceNoteUrl } = validation.data;

    // Verify user has access to the checklist item
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
        },
      },
    });

    if (!user) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'User not found', 404);
    }

    const item = await prisma.patientChecklistItem.findUnique({
      where: { id: itemId },
      include: {
        patient: {
          include: {
            family: true,
          },
        },
      },
    });

    if (!item) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Checklist item not found', 404);
    }

    // Check if user has access to this patient's family
    const hasAccess = user.familyMembers.some(
      fm => fm.familyId === item.patient.familyId
    );

    if (!hasAccess) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Access denied', 403);
    }

    // Create log entry and journal entry in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create checklist log
      const log = await tx.patientChecklistLog.create({
        data: {
          itemId,
          completedById: user.id,
          notes,
          voiceNoteUrl,
        },
      });

      // Create journal entry
      const journalContent = notes
        ? `Completed task: ${item.title}\n\nNotes: ${notes}`
        : `Completed task: ${item.title}`;

      const journalEntry = await tx.journalEntry.create({
        data: {
          familyId: item.patient.familyId,
          userId: user.id,
          content: journalContent,
          isPrivate: false,
          attachmentUrls: voiceNoteUrl ? [voiceNoteUrl] : [],
          analysisData: {
            source: 'patient_checklist',
            checklistItemId: itemId,
            checklistItemTitle: item.title,
            checklistItemCategory: item.category,
            scheduledTime: item.scheduledTime,
            hasNotes: !!notes,
            completedByType: user.userType,
          },
        },
      });

      return { log, journalEntry };
    });

    res.json({ log: result.log, journalEntry: result.journalEntry });
  }

  // Create checklist item (caregiver only)
  async createChecklistItem(req: AuthRequest, res: Response) {
    const validation = createChecklistItemSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid input', 400, validation.error.errors);
    }

    const userId = req.auth!.userId;
    const { patientId, title, description, category, scheduledTime } = validation.data;

    // Verify user has access and is a caregiver
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: {
            family: {
              include: {
                patient: {
                  where: { id: patientId },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.familyMembers.some(fm => fm.family.patient?.id === patientId)) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Access denied to this patient', 403);
    }

    // Check if user is a caregiver
    const isCaregiver = user.familyMembers.some(
      fm => fm.family.patient?.id === patientId &&
           ['primary_caregiver', 'caregiver'].includes(fm.role)
    );

    if (!isCaregiver) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Only caregivers can create checklist items', 403);
    }

    const item = await prisma.patientChecklistItem.create({
      data: {
        patientId,
        title,
        description,
        category: category as ChecklistCategory,
        scheduledTime,
        createdById: user.id,
      },
    });

    res.status(201).json({ item });
  }

  // Get all checklist items for a patient (caregiver view)
  async getChecklistItems(req: AuthRequest, res: Response) {
    const { patientId } = req.params;
    const userId = req.auth!.userId;

    // Verify user has access
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: {
            family: {
              include: {
                patient: {
                  where: { id: patientId },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.familyMembers.some(fm => fm.family.patient?.id === patientId)) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Access denied to this patient', 403);
    }

    const items = await prisma.patientChecklistItem.findMany({
      where: {
        patientId,
        isActive: true,
      },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        { category: 'asc' },
        { title: 'asc' },
      ],
    });

    res.json({ items });
  }

  // Update checklist item
  async updateChecklistItem(req: AuthRequest, res: Response) {
    const { itemId } = req.params;
    const { title, description, category, scheduledTime, isActive } = req.body;
    const userId = req.auth!.userId;

    // Verify access and caregiver role
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
        },
      },
    });

    if (!user) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'User not found', 404);
    }

    const item = await prisma.patientChecklistItem.findUnique({
      where: { id: itemId },
      include: {
        patient: {
          include: {
            family: true,
          },
        },
      },
    });

    if (!item) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Checklist item not found', 404);
    }

    const hasAccess = user.familyMembers.some(
      fm => fm.familyId === item.patient.familyId &&
           ['primary_caregiver', 'caregiver'].includes(fm.role)
    );

    if (!hasAccess) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Access denied', 403);
    }

    const updatedItem = await prisma.patientChecklistItem.update({
      where: { id: itemId },
      data: {
        title,
        description,
        category: category as ChecklistCategory,
        scheduledTime,
        isActive,
      },
    });

    res.json({ item: updatedItem });
  }

  // Delete checklist item
  async deleteChecklistItem(req: AuthRequest, res: Response) {
    const { itemId } = req.params;
    const userId = req.auth!.userId;

    // Verify access and caregiver role
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
        },
      },
    });

    if (!user) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'User not found', 404);
    }

    const item = await prisma.patientChecklistItem.findUnique({
      where: { id: itemId },
      include: {
        patient: {
          include: {
            family: true,
          },
        },
      },
    });

    if (!item) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Checklist item not found', 404);
    }

    const hasAccess = user.familyMembers.some(
      fm => fm.familyId === item.patient.familyId &&
           fm.role === 'primary_caregiver'
    );

    if (!hasAccess) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Only primary caregivers can delete checklist items', 403);
    }

    // Soft delete
    await prisma.patientChecklistItem.update({
      where: { id: itemId },
      data: { isActive: false },
    });

    res.json({ message: 'Checklist item deleted successfully' });
  }
}

export const patientController = new PatientController();
