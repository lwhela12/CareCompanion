import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma, CareTaskPriority, CareTaskStatus } from '@carecompanion/database';
import { ApiError } from '../middleware/error';
import { ErrorCodes } from '@carecompanion/shared';
import { AuthRequest } from '../types';
import { logger } from '../utils/logger';
import { auditService, AuditActions, ResourceTypes } from '../services/audit.service';
import { startOfDay, endOfDay, parseISO, addDays, addWeeks, addMonths, isBefore, isAfter } from 'date-fns';
import { recurrenceService } from '../services/recurrence.service';

// Validation schemas
const createCareTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  reminderDate: z.string().optional(),
  assignedToId: z.string().nullable().optional(),
  priority: z.enum(['high', 'medium', 'low']).optional().default('medium'),
  recurrenceRule: z.string().optional(), // RRULE format for recurring tasks
  isRecurring: z.boolean().optional(),
  recurrenceType: z.enum(['daily', 'weekly', 'biweekly', 'monthly']).optional(),
  recurrenceEndDate: z.string().optional(),
});

const updateCareTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  reminderDate: z.string().optional(),
  assignedToId: z.string().nullable().optional(),
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
      const { title, description, dueDate, reminderDate, assignedToId: rawAssignedToId, priority, isRecurring, recurrenceType, recurrenceEndDate } = validation.data;

      logger.debug('Creating care task with data:', {
        title,
        description,
        dueDate,
        reminderDate,
        assignedToId: rawAssignedToId,
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
    let assignedToId = rawAssignedToId;
    if (assignedToId) {
      // Check if it's a patient assignment
      if (assignedToId.startsWith('patient-')) {
        // For patient assignments, we'll store null as assignedToId
        // since the Patient model is separate from User
        assignedToId = null;
      } else {
        // For user assignments, verify they're a family member
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
    }

    // Create recurrence rule if applicable
    let recurrenceRule = null;
    if (isRecurring && recurrenceType) {
      const pattern = {
        type: recurrenceType,
        endDate: recurrenceEndDate ? new Date(recurrenceEndDate) : undefined
      };
      recurrenceRule = recurrenceService.createRecurrenceRule(pattern);
    }

    // Create the task (single task for recurring, or regular task)
    const task = await prisma.careTask.create({
      data: {
        familyId,
        title,
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        reminderDate: reminderDate ? new Date(reminderDate) : null,
        assignedToId: assignedToId || null,
        createdById: user.id,
        priority: (priority?.toUpperCase() || 'MEDIUM') as CareTaskPriority,
        status: 'PENDING' as CareTaskStatus,
        recurrenceRule,
        recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
        isRecurrenceTemplate: !!recurrenceRule,
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

    // Audit log
    await auditService.logFromRequest({
      req,
      action: AuditActions.CREATE_CARE_TASK,
      resourceType: ResourceTypes.CARE_TASK,
      resourceId: task.id,
      metadata: { title, priority, isRecurring },
      familyId,
      userId: user.id,
    });

    res.status(201).json({
      task,
      message: isRecurring ? 'Recurring appointment created' : 'Appointment created'
    });
    } catch (error: any) {
      logger.error('Failed to create care task:', error);
      throw error;
    }
  }

  // Get care tasks for the family
  async getTasks(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { status, assignedToId, startDate, endDate, includeVirtual } = req.query;

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

    // For date filtering, we need to consider reminder dates and due dates
    const dateRangeStart = startDate ? startOfDay(parseISO(startDate as string)) : null;
    const dateRangeEnd = endDate ? endOfDay(parseISO(endDate as string)) : null;

    const conditions: any[] = [];

    // Base condition: not a recurrence template (unless showing virtual)
    if (!includeVirtual || includeVirtual !== 'true') {
      conditions.push({ isRecurrenceTemplate: { not: true } });
    }

    if (dateRangeStart || dateRangeEnd) {
      const dateConditions = [];
      
      // Tasks with due date in range (for appointments/one-time tasks)
      if (dateRangeStart && dateRangeEnd) {
        dateConditions.push({
          AND: [
            { dueDate: { gte: dateRangeStart } },
            { dueDate: { lte: dateRangeEnd } },
            { reminderDate: null }
          ]
        });
      }
      
      // Tasks where today is between reminder and due date
      dateConditions.push({
        AND: [
          { reminderDate: dateRangeEnd ? { lte: dateRangeEnd } : {} },
          { 
            OR: [
              { dueDate: dateRangeStart ? { gte: dateRangeStart } : {} },
              { dueDate: null }
            ]
          }
        ]
      });
      
      conditions.push({ OR: dateConditions });
    }

    if (conditions.length > 0) {
      where.AND = conditions;
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

    // If includeVirtual is true and we have a date range, calculate virtual occurrences
    let allTasks: any[] = tasks;
    
    if (includeVirtual === 'true' && dateRangeStart && dateRangeEnd) {
      // Get all recurrence templates for the family
      const recurrenceTemplates = await prisma.careTask.findMany({
        where: {
          familyId,
          isRecurrenceTemplate: true,
          recurrenceRule: { not: null },
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

      // Get all materialized tasks for filtering
      const materializedTasks = await prisma.careTask.findMany({
        where: {
          familyId,
          parentTaskId: { not: null },
          dueDate: {
            gte: dateRangeStart,
            lte: dateRangeEnd
          }
        },
        select: {
          parentTaskId: true,
          dueDate: true
        }
      });

      // Create a set of materialized dates for each parent task
      const materializedDates = new Map<string, Set<number>>();
      materializedTasks.forEach(task => {
        if (task.parentTaskId && task.dueDate) {
          if (!materializedDates.has(task.parentTaskId)) {
            materializedDates.set(task.parentTaskId, new Set());
          }
          // Store date as midnight timestamp for comparison
          const dateOnly = startOfDay(new Date(task.dueDate)).getTime();
          materializedDates.get(task.parentTaskId)!.add(dateOnly);
        }
      });

      // Calculate virtual occurrences for each template
      const virtualTasks: any[] = [];
      for (const template of recurrenceTemplates) {
        const occurrences = recurrenceService.calculateOccurrences(
          template as any,
          dateRangeStart,
          dateRangeEnd
        );
        
        // Filter out occurrences that have been materialized
        const filteredOccurrences = occurrences.filter(occ => {
          const materializedSet = materializedDates.get(template.id);
          if (!materializedSet) return true;
          
          // Check if this date has been materialized
          const occDateOnly = startOfDay(new Date(occ.dueDate)).getTime();
          return !materializedSet.has(occDateOnly);
        });
        
        // Add assignedTo info to virtual tasks
        const occurrencesWithAssignee = filteredOccurrences.map(occ => ({
          ...occ,
          assignedTo: template.assignedTo,
        }));
        
        virtualTasks.push(...occurrencesWithAssignee);
      }

      // Combine physical and virtual tasks
      allTasks = [...tasks.filter(t => !t.isRecurrenceTemplate), ...virtualTasks];
      
      // Sort combined results
      allTasks.sort((a, b) => {
        // First by status
        const statusOrder = { PENDING: 0, IN_PROGRESS: 1, COMPLETED: 2, CANCELLED: 3 };
        const statusDiff = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
        if (statusDiff !== 0) return statusDiff;
        
        // Then by priority
        const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        const priorityDiff = (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
        if (priorityDiff !== 0) return priorityDiff;
        
        // Finally by due date
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        return dateA - dateB;
      });
    }

    res.json({ tasks: allTasks });
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

    // Check if this is a virtual task ID
    if (taskId.includes('_virtual_')) {
      throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Cannot update virtual tasks directly. Complete or create a physical instance first.', 400);
    }

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
      reminderDate: updates.reminderDate ? new Date(updates.reminderDate) : undefined,
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

  // Update a recurring series
  async updateSeries(req: AuthRequest, res: Response) {
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

    // Determine the template ID
    let templateId = taskId;
    
    // If this is a materialized instance, get its parent template
    const task = await prisma.careTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Task not found', 404);
    }

    if (task.parentTaskId) {
      templateId = task.parentTaskId;
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
      reminderDate: updates.reminderDate ? new Date(updates.reminderDate) : undefined,
    };
    
    if (updates.priority) {
      prismaUpdates.priority = updates.priority.toUpperCase() as CareTaskPriority;
    }
    
    if (updates.status) {
      prismaUpdates.status = updates.status.toUpperCase().replace(/-/g, '_') as CareTaskStatus;
    }

    // Start a transaction to update template and clean up instances
    const result = await prisma.$transaction(async (tx) => {
      // Get the reference date - either from the selected occurrence or current date
      const referenceDate = updates.dueDate ? new Date(updates.dueDate) : new Date();
      
      // First, get the current template to calculate past occurrences
      const currentTemplate = await tx.careTask.findUnique({
        where: { id: templateId },
      });
      
      if (!currentTemplate || !currentTemplate.recurrenceRule) {
        throw new ApiError(ErrorCodes.NOT_FOUND, 'Template not found or not recurring', 404);
      }
      
      // Calculate all past occurrences that need to be materialized
      const startDate = currentTemplate.dueDate || new Date();
      const endDate = new Date(referenceDate);
      endDate.setHours(0, 0, 0, 0); // Set to start of day
      
      // Only materialize if there are past dates to preserve
      if (startDate < endDate) {
        const pastOccurrences = recurrenceService.calculateOccurrences(
          currentTemplate as any,
          startDate,
          endDate
        );
        
        // Check which ones are already materialized
        const existingMaterialized = await tx.careTask.findMany({
          where: {
            parentTaskId: templateId,
            dueDate: {
              lt: referenceDate
            }
          },
          select: {
            dueDate: true
          }
        });
        
        // Create a set of existing dates for quick lookup
        const existingDates = new Set(
          existingMaterialized.map(t => t.dueDate?.toISOString().split('T')[0])
        );
        
        // Materialize any past occurrences that aren't already materialized
        for (const occurrence of pastOccurrences) {
          const occDate = new Date(occurrence.dueDate);
          const dateStr = occDate.toISOString().split('T')[0];
          
          if (!existingDates.has(dateStr) && occDate < referenceDate) {
            const materializedData = recurrenceService.materializeOccurrence(
              currentTemplate,
              occDate,
              user.id
            );
            
            await tx.careTask.create({
              data: materializedData,
            });
          }
        }
      }
      
      // Update the template
      const updatedTemplate = await tx.careTask.update({
        where: { id: templateId },
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

      // Delete only future materialized instances of this template
      const deletedCount = await tx.careTask.deleteMany({
        where: {
          parentTaskId: templateId,
          status: { in: ['PENDING', 'CANCELLED'] }, // Only delete non-completed instances
          dueDate: {
            gte: referenceDate // Only delete instances on or after the reference date
          }
        },
      });

      // Log the update
      await tx.careTaskLog.create({
        data: {
          taskId: templateId,
          userId: user.id,
          action: `updated series: ${Object.keys(updates).join(', ')}. Materialized past occurrences and removed ${deletedCount.count} future instances.`,
        },
      });

      return { updatedTemplate, deletedCount: deletedCount.count };
    });

    res.json({ 
      task: result.updatedTemplate,
      message: `Series updated. ${result.deletedCount} future instances removed.`
    });
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

    // Audit log BEFORE deletion
    await auditService.logFromRequest({
      req,
      action: AuditActions.DELETE_CARE_TASK,
      resourceType: ResourceTypes.CARE_TASK,
      resourceId: taskId,
      metadata: { title: task.title },
      familyId: task.familyId,
      userId: user.id,
    });

    await prisma.careTask.delete({
      where: { id: taskId },
    });

    res.json({ message: 'Task deleted successfully' });
  }

  // Complete a care task
  async completeTask(req: AuthRequest, res: Response) {
    const { taskId } = req.params;
    const { notes, virtualDate } = req.body;
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

    let actualTaskId = taskId;
    let task;

    // Check if this is a virtual task ID
    if (taskId.includes('_virtual_')) {
      // Extract parent task ID from virtual ID
      const parentTaskId = taskId.split('_virtual_')[0];
      
      // Get the parent task
      const parentTask = await prisma.careTask.findUnique({
        where: { id: parentTaskId },
      });

      if (!parentTask) {
        throw new ApiError(ErrorCodes.NOT_FOUND, 'Parent task not found', 404);
      }

      // Check access to parent task
      const hasAccess = user.familyMembers.some(fm => fm.familyId === parentTask.familyId);
      if (!hasAccess) {
        throw new ApiError(ErrorCodes.FORBIDDEN, 'Access denied', 403);
      }

      // Materialize the virtual task
      const occurrenceDate = virtualDate ? new Date(virtualDate) : new Date();
      const materializedTaskData = recurrenceService.materializeOccurrence(
        parentTask,
        occurrenceDate,
        user.id
      );

      // Create the physical task
      task = await prisma.careTask.create({
        data: materializedTaskData,
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

      actualTaskId = task.id;

      // Log the materialization
      await prisma.careTaskLog.create({
        data: {
          taskId: task.id,
          userId: user.id,
          action: 'materialized from recurrence',
        },
      });
    } else {
      // Regular task - get it from database
      task = await prisma.careTask.findUnique({
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
    }

    // Update task status
    const updatedTask = await prisma.careTask.update({
      where: { id: actualTaskId },
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
        taskId: actualTaskId,
        userId: user.id,
        action: 'completed',
        notes,
      },
    });

    // Audit log
    await auditService.logFromRequest({
      req,
      action: AuditActions.COMPLETE_CARE_TASK,
      resourceType: ResourceTypes.CARE_TASK,
      resourceId: actualTaskId,
      metadata: { title: updatedTask.title, notes },
      familyId: updatedTask.familyId,
      userId: user.id,
    });

    res.json({ task: updatedTask });
  }

  // Materialize a virtual task without completing it
  async materializeTask(req: AuthRequest, res: Response) {
    const { taskId } = req.params;
    const { virtualDate } = req.body;
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

    // Check if this is a virtual task ID
    if (!taskId.includes('_virtual_')) {
      throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Not a virtual task ID', 400);
    }

    // Extract parent task ID from virtual ID
    const parentTaskId = taskId.split('_virtual_')[0];
    
    // Get the parent task
    const parentTask = await prisma.careTask.findUnique({
      where: { id: parentTaskId },
    });

    if (!parentTask) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Parent task not found', 404);
    }

    // Check access to parent task
    const hasAccess = user.familyMembers.some(fm => fm.familyId === parentTask.familyId);
    if (!hasAccess) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Access denied', 403);
    }

    // Materialize the virtual task
    const occurrenceDate = virtualDate ? new Date(virtualDate) : new Date();
    const materializedTaskData = recurrenceService.materializeOccurrence(
      parentTask,
      occurrenceDate,
      user.id
    );

    // Create the physical task
    const task = await prisma.careTask.create({
      data: materializedTaskData,
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

    // Log the materialization
    await prisma.careTaskLog.create({
      data: {
        taskId: task.id,
        userId: user.id,
        action: 'materialized from recurrence',
      },
    });

    res.json({ task });
  }
}

export const careTaskController = new CareTaskController();