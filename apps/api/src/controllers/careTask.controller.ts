import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@carecompanion/database';
import { CareTaskPriority, CareTaskStatus } from '@prisma/client';
import { ApiError } from '../middleware/error';
import { ErrorCodes } from '@carecompanion/shared';
import { AuthRequest } from '../types';
import { startOfDay, endOfDay, parseISO } from 'date-fns';

// Validation schemas
const createCareTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  assignedToId: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).optional().default('medium'),
  recurrenceRule: z.string().optional(), // RRULE format for recurring tasks
});

const updateCareTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  assignedToId: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
});

export class CareTaskController {
  // Create a new care task
  async createTask(req: AuthRequest, res: Response) {
    try {
      const validation = createCareTaskSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid input', 400, validation.error.errors);
      }

      const userId = req.auth!.userId;
      const { title, description, dueDate, assignedToId, priority } = validation.data;

      console.log('Creating care task with data:', {
        title,
        description,
        dueDate,
        assignedToId,
        priority,
        userId
      });

      // Get user's family
      const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: {
            family: true,
          },
        },
      },
    });

    if (!user || user.familyMembers.length === 0) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'No family found', 404);
    }

    const familyId = user.familyMembers[0].familyId;

    // Verify assignedToId is a family member if provided
    if (assignedToId) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: assignedToId },
        include: {
          familyMembers: {
            where: { familyId, isActive: true },
          },
        },
      });

      if (!assignedUser || assignedUser.familyMembers.length === 0) {
        throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Assigned user is not a family member', 400);
      }
    }

    console.log('Creating task with Prisma data:', {
      familyId,
      title,
      description: description || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      assignedToId: assignedToId || null,
      createdById: user.id,
      priority: priority || 'medium',
      status: 'pending',
    });

    // Create the care task
    const task = await prisma.careTask.create({
      data: {
        familyId,
        title,
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        assignedToId: assignedToId || null,
        createdById: user.id,
        priority: (priority?.toUpperCase() || 'MEDIUM') as CareTaskPriority,
        status: 'PENDING' as CareTaskStatus,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Create a log entry
    await prisma.careTaskLog.create({
      data: {
        taskId: task.id,
        userId: user.id,
        action: 'created',
      },
    });

      res.status(201).json({ task });
    } catch (error: any) {
      console.error('Failed to create care task:', error);
      throw error;
    }
  }

  // Get care tasks for the family
  async getTasks(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { status, assignedToId, startDate, endDate } = req.query;

    // Get user's family
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
        },
      },
    });

    if (!user || user.familyMembers.length === 0) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'No family found', 404);
    }

    const familyId = user.familyMembers[0].familyId;

    // Build query conditions
    const where: any = { familyId };

    if (status) {
      where.status = status as CareTaskStatus;
    }

    if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) {
        where.dueDate.gte = startOfDay(parseISO(startDate as string));
      }
      if (endDate) {
        where.dueDate.lte = endOfDay(parseISO(endDate as string));
      }
    }

    const tasks = await prisma.careTask.findMany({
      where,
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        logs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { dueDate: 'asc' },
      ],
    });

    res.json({ tasks });
  }

  // Get a single care task
  async getTask(req: AuthRequest, res: Response) {
    const { taskId } = req.params;
    const userId = req.auth!.userId;

    // Get user and verify access
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

    // Get the task
    const task = await prisma.careTask.findUnique({
      where: { id: taskId },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        logs: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!task) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Task not found', 404);
    }

    // Check access
    const hasAccess = user.familyMembers.some(fm => fm.familyId === task.familyId);
    if (!hasAccess) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Access denied', 403);
    }

    res.json({ task });
  }

  // Update a care task
  async updateTask(req: AuthRequest, res: Response) {
    const { taskId } = req.params;
    const validation = updateCareTaskSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid input', 400, validation.error.errors);
    }

    const userId = req.auth!.userId;
    const updates = validation.data;

    // Get user
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

    // Get the task
    const task = await prisma.careTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Task not found', 404);
    }

    // Check access
    const hasAccess = user.familyMembers.some(fm => fm.familyId === task.familyId);
    if (!hasAccess) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Access denied', 403);
    }

    // Convert enums to uppercase for Prisma
    const prismaUpdates: any = {
      ...updates,
      dueDate: updates.dueDate ? new Date(updates.dueDate) : undefined,
    };
    
    if (updates.priority) {
      prismaUpdates.priority = updates.priority.toUpperCase() as CareTaskPriority;
    }
    
    if (updates.status) {
      prismaUpdates.status = updates.status.toUpperCase().replace(/-/g, '_') as CareTaskStatus;
    }

    // Update the task
    const updatedTask = await prisma.careTask.update({
      where: { id: taskId },
      data: prismaUpdates,
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Log the update
    const changes = Object.keys(updates).join(', ');
    await prisma.careTaskLog.create({
      data: {
        taskId,
        userId: user.id,
        action: `updated: ${changes}`,
      },
    });

    res.json({ task: updatedTask });
  }

  // Delete a care task
  async deleteTask(req: AuthRequest, res: Response) {
    const { taskId } = req.params;
    const userId = req.auth!.userId;

    // Get user
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

    // Get the task
    const task = await prisma.careTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Task not found', 404);
    }

    // Check permissions - only creator or primary caregiver can delete
    const canDelete = task.createdById === user.id || 
      user.familyMembers.some(fm => 
        fm.familyId === task.familyId && fm.role === 'primary_caregiver'
      );

    if (!canDelete) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Insufficient permissions to delete', 403);
    }

    await prisma.careTask.delete({
      where: { id: taskId },
    });

    res.json({ message: 'Task deleted successfully' });
  }

  // Complete a care task
  async completeTask(req: AuthRequest, res: Response) {
    const { taskId } = req.params;
    const { notes } = req.body;
    const userId = req.auth!.userId;

    // Get user
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

    // Get the task
    const task = await prisma.careTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Task not found', 404);
    }

    // Check access
    const hasAccess = user.familyMembers.some(fm => fm.familyId === task.familyId);
    if (!hasAccess) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Access denied', 403);
    }

    // Update task status
    const updatedTask = await prisma.careTask.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED' as CareTaskStatus,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Log the completion
    await prisma.careTaskLog.create({
      data: {
        taskId,
        userId: user.id,
        action: 'completed',
        notes,
      },
    });

    res.json({ task: updatedTask });
  }
}

export const careTaskController = new CareTaskController();