import { Router } from 'express';
import { PrismaClient } from '@carecompanion/database';
import { createPatientSchema, paginationSchema } from '@carecompanion/shared';
import { validate, validateQuery } from '../middleware/validate';
import { authorize, checkResourceAccess } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get all patients in family
router.get('/', validateQuery(paginationSchema), async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query as any;
    const skip = (page - 1) * limit;

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where: { familyId: req.user!.familyId },
        include: {
          primaryCaregiver: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              medications: true,
              journalEntries: true,
              careTasks: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.patient.count({
        where: { familyId: req.user!.familyId },
      }),
    ]);

    res.json({
      data: patients,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Create patient
router.post(
  '/',
  authorize('admin', 'care_coordinator'),
  validate(createPatientSchema),
  async (req, res, next) => {
    try {
      const patient = await prisma.patient.create({
        data: {
          ...req.body,
          familyId: req.user!.familyId,
        },
        include: {
          primaryCaregiver: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      res.status(201).json(patient);
    } catch (error) {
      next(error);
    }
  }
);

// Get patient by ID
router.get(
  '/:id',
  checkResourceAccess('patient'),
  async (req, res, next) => {
    try {
      const patient = await prisma.patient.findUnique({
        where: { id: req.params.id },
        include: {
          primaryCaregiver: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          medications: {
            where: {
              OR: [
                { endDate: null },
                { endDate: { gte: new Date() } },
              ],
            },
            orderBy: { name: 'asc' },
          },
          _count: {
            select: {
              journalEntries: true,
              careTasks: true,
              documents: true,
              insights: {
                where: { acknowledgedAt: null },
              },
            },
          },
        },
      });

      res.json(patient);
    } catch (error) {
      next(error);
    }
  }
);

// Update patient
router.put(
  '/:id',
  authorize('admin', 'care_coordinator'),
  checkResourceAccess('patient'),
  validate(createPatientSchema.partial()),
  async (req, res, next) => {
    try {
      const patient = await prisma.patient.update({
        where: { id: req.params.id },
        data: req.body,
        include: {
          primaryCaregiver: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      res.json(patient);
    } catch (error) {
      next(error);
    }
  }
);

// Delete patient
router.delete(
  '/:id',
  authorize('admin'),
  checkResourceAccess('patient'),
  async (req, res, next) => {
    try {
      await prisma.patient.delete({
        where: { id: req.params.id },
      });

      res.json({ message: 'Patient deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// Get patient summary
router.get(
  '/:id/summary',
  checkResourceAccess('patient'),
  async (req, res, next) => {
    try {
      const patientId = req.params.id;
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [
        medicationAdherence,
        recentJournalEntries,
        pendingTasks,
        activeInsights,
      ] = await Promise.all([
        // Medication adherence
        prisma.medicationLog.groupBy({
          by: ['status'],
          where: {
            medication: { patientId },
            scheduledTime: { gte: weekAgo },
          },
          _count: true,
        }),
        // Recent journal entries
        prisma.journalEntry.count({
          where: {
            patientId,
            createdAt: { gte: weekAgo },
          },
        }),
        // Pending care tasks
        prisma.careTask.count({
          where: {
            patientId,
            careTaskLogs: {
              none: {
                scheduledDate: {
                  gte: today,
                  lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
                },
              },
            },
          },
        }),
        // Active insights
        prisma.insight.count({
          where: {
            patientId,
            acknowledgedAt: null,
          },
        }),
      ]);

      // Calculate adherence rate
      const totalMeds = medicationAdherence.reduce((sum, item) => sum + item._count, 0);
      const givenMeds = medicationAdherence.find(item => item.status === 'given')?._count || 0;
      const adherenceRate = totalMeds > 0 ? givenMeds / totalMeds : 1;

      res.json({
        patientId,
        week: {
          start: weekAgo.toISOString(),
          end: today.toISOString(),
        },
        medicationAdherence: {
          rate: adherenceRate,
          given: givenMeds,
          total: totalMeds,
        },
        journalEntries: recentJournalEntries,
        pendingTasks,
        activeInsights,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;