import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma, MedicationStatus } from '@carecompanion/database';
import { ApiError } from '../middleware/error';
import { ErrorCodes } from '@carecompanion/shared';
import { AuthRequest } from '../types';
import { startOfDay, endOfDay, addDays, format } from 'date-fns';

// Validation schemas
const createMedicationSchema = z.object({
  patientId: z.string().uuid(),
  name: z.string().min(1).max(100),
  dosage: z.string().min(1).max(50),
  dosageAmount: z.number().positive().optional(),
  dosageUnit: z.string().max(20).optional(),
  frequency: z.string().min(1).max(50),
  scheduleTimes: z.array(z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)),
  instructions: z.string().max(500).optional(),
  prescribedBy: z.string().max(100).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  currentSupply: z.number().int().positive().optional(),
  refillThreshold: z.number().int().positive().default(7),
});

const updateMedicationSchema = createMedicationSchema.partial();

const logMedicationSchema = z.object({
  scheduledTime: z.string().datetime(),
  status: z.enum(['given', 'missed', 'refused']),
  notes: z.string().max(500).optional(),
});

const refillMedicationSchema = z.object({
  pillsAdded: z.number().int().positive(),
  refillDate: z.string().datetime().optional(),
});

export class MedicationController {
  // Get all medications for the family (for calendar view)
  async getMedications(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { includeSchedules } = req.query;

    // Get user's family
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: {
            family: {
              include: {
                patient: true,
              },
            },
          },
        },
      },
    });

    if (!user || user.familyMembers.length === 0) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'No family found', 404);
    }

    const family = user.familyMembers[0].family;
    const patientId = family.patient?.id;

    if (!patientId) {
      return res.json({ medications: [] });
    }

    const medications = await prisma.medication.findMany({
      where: {
        patientId,
        isActive: true,
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Include schedule times if requested (for calendar)
    const medicationsWithSchedules = medications.map((med) => ({
      ...med,
      scheduleTimes: includeSchedules ? med.scheduleTime : undefined,
    }));

    res.json({ medications: medicationsWithSchedules });
  }

  // Create a new medication
  async createMedication(req: AuthRequest, res: Response) {
    const validation = createMedicationSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid input', 400, validation.error.errors);
    }

    const userId = req.auth!.userId;
    const data = validation.data;

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
                  where: { id: data.patientId },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.familyMembers.some(fm => fm.family.patient?.id === data.patientId)) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Access denied to this patient', 403);
    }

    // Create the medication
    const medication = await prisma.medication.create({
      data: {
        patientId: data.patientId,
        name: data.name,
        dosage: data.dosage,
        dosageAmount: data.dosageAmount,
        dosageUnit: data.dosageUnit,
        frequency: data.frequency,
        scheduleTime: data.scheduleTimes,
        instructions: data.instructions,
        prescribedBy: data.prescribedBy,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        currentSupply: data.currentSupply,
        refillThreshold: data.refillThreshold,
        createdById: user.id,
      },
    });

    res.status(201).json({ medication });
  }

  // Get medications for a patient
  async getPatientMedications(req: AuthRequest, res: Response) {
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

    const medications = await prisma.medication.findMany({
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
      orderBy: { name: 'asc' },
    });

    // Calculate days supply remaining
    const medicationsWithSupply = medications.map((med) => {
      let daysRemaining = null;
      if (med.currentSupply && med.dosageAmount && med.scheduleTime.length > 0) {
        const dailyDoses = med.scheduleTime.length * med.dosageAmount;
        daysRemaining = Math.floor(med.currentSupply / dailyDoses);
      }

      return {
        ...med,
        daysRemaining,
        needsRefill: daysRemaining !== null && daysRemaining <= med.refillThreshold,
      };
    });

    res.json({ medications: medicationsWithSupply });
  }

  // Get today's medication schedule
  async getTodaysMedications(req: AuthRequest, res: Response) {
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

    // Get active medications
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
    });

    // Get today's logs
    const logs = await prisma.medicationLog.findMany({
      where: {
        medication: { patientId },
        scheduledTime: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      include: {
        givenBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Build schedule for today
    const schedule = [];
    for (const med of medications) {
      for (const time of med.scheduleTime) {
        const [hours, minutes] = time.split(':').map(Number);
        const scheduledTime = new Date(today);
        scheduledTime.setHours(hours, minutes, 0, 0);

        // Find if there's a log for this scheduled time
        const log = logs.find(
          (l) =>
            l.medicationId === med.id &&
            l.scheduledTime.getTime() === scheduledTime.getTime()
        );

        schedule.push({
          medicationId: med.id,
          medicationName: med.name,
          dosage: med.dosage,
          scheduledTime: scheduledTime.toISOString(),
          timeString: time,
          status: log?.status.toLowerCase() || 'pending',
          givenTime: log?.givenTime,
          givenBy: log?.givenBy,
          notes: log?.notes,
          logId: log?.id,
        });
      }
    }

    // Sort by scheduled time
    schedule.sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());

    res.json({ schedule });
  }

  // Log medication administration
  async logMedication(req: AuthRequest, res: Response) {
    const { medicationId } = req.params;
    const validation = logMedicationSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid input', 400, validation.error.errors);
    }

    const userId = req.auth!.userId;
    const { scheduledTime, status, notes } = validation.data;

    // Verify user has access to the medication
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: {
            family: {
              include: {
                patient: {
                  include: {
                    medications: {
                      where: { id: medicationId },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'User not found', 404);
    }

    const hasAccess = user.familyMembers.some(
      (fm) => fm.family.patient?.medications.length > 0
    );

    if (!hasAccess) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Access denied to this medication', 403);
    }

    const medication = await prisma.medication.findUnique({
      where: { id: medicationId },
    });

    if (!medication) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Medication not found', 404);
    }

    // Create or update the log
    const log = await prisma.medicationLog.upsert({
      where: {
        medicationId_scheduledTime: {
          medicationId,
          scheduledTime: new Date(scheduledTime),
        },
      },
      update: {
        status: status.toUpperCase() as MedicationStatus,
        givenTime: status === 'given' ? new Date() : null,
        givenById: status === 'given' ? user.id : null,
        notes,
      },
      create: {
        medicationId,
        scheduledTime: new Date(scheduledTime),
        status: status.toUpperCase() as MedicationStatus,
        givenTime: status === 'given' ? new Date() : null,
        givenById: status === 'given' ? user.id : null,
        notes,
      },
      include: {
        givenBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Update pill count if given
    if (status === 'given' && medication.currentSupply && medication.dosageAmount) {
      await prisma.medication.update({
        where: { id: medicationId },
        data: {
          currentSupply: {
            decrement: medication.dosageAmount,
          },
        },
      });
    }

    res.json({ log });
  }

  // Update medication
  async updateMedication(req: AuthRequest, res: Response) {
    const { medicationId } = req.params;
    const validation = updateMedicationSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid input', 400, validation.error.errors);
    }

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
                  include: {
                    medications: {
                      where: { id: medicationId },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const hasAccess = user?.familyMembers.some(
      (fm) => fm.family.patient?.medications.length > 0 &&
        ['primary_caregiver', 'caregiver'].includes(fm.role)
    );

    if (!hasAccess) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Access denied', 403);
    }

    const { scheduleTimes, ...data } = validation.data;

    const medication = await prisma.medication.update({
      where: { id: medicationId },
      data: {
        ...data,
        scheduleTime: scheduleTimes,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    });

    res.json({ medication });
  }

  // Refill medication
  async refillMedication(req: AuthRequest, res: Response) {
    const { medicationId } = req.params;
    const validation = refillMedicationSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid input', 400, validation.error.errors);
    }

    const userId = req.auth!.userId;
    const { pillsAdded, refillDate } = validation.data;

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
                  include: {
                    medications: {
                      where: { id: medicationId },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const hasAccess = user?.familyMembers.some(
      (fm) => fm.family.patient?.medications.length > 0
    );

    if (!hasAccess) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Access denied', 403);
    }

    const medication = await prisma.medication.update({
      where: { id: medicationId },
      data: {
        currentSupply: {
          increment: pillsAdded,
        },
        lastRefillDate: refillDate ? new Date(refillDate) : new Date(),
      },
    });

    res.json({ medication });
  }

  // Delete (deactivate) medication
  async deleteMedication(req: AuthRequest, res: Response) {
    const { medicationId } = req.params;
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
                  include: {
                    medications: {
                      where: { id: medicationId },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const hasAccess = user?.familyMembers.some(
      (fm) => fm.family.patient?.medications.length > 0 &&
        ['primary_caregiver', 'caregiver'].includes(fm.role)
    );

    if (!hasAccess) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Access denied', 403);
    }

    await prisma.medication.update({
      where: { id: medicationId },
      data: { isActive: false },
    });

    res.json({ message: 'Medication deactivated successfully' });
  }
}

export const medicationController = new MedicationController();