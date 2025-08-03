import { CareTask, CareTaskStatus, CareTaskPriority } from '@carecompanion/database';
import { 
  addDays, 
  addWeeks, 
  addMonths, 
  startOfDay, 
  endOfDay, 
  isAfter, 
  isBefore, 
  isEqual,
  isSameDay,
  setHours,
  setMinutes,
  getDay,
  getDate
} from 'date-fns';

export interface RecurrencePattern {
  type: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  endDate?: Date;
}

export interface VirtualTask {
  id: string;
  familyId: string;
  title: string;
  description?: string | null;
  dueDate: Date;
  assignedToId?: string | null;
  priority: CareTaskPriority;
  status: CareTaskStatus;
  isVirtual: true;
  parentTaskId: string;
  recurrenceRule: string;
}

export class RecurrenceService {
  /**
   * Parse recurrence rule from string format
   */
  parseRecurrenceRule(rule: string): RecurrencePattern | null {
    if (!rule) return null;
    
    try {
      const parts = rule.split(';');
      const type = parts[0] as RecurrencePattern['type'];
      const endDate = parts[1] ? new Date(parts[1]) : undefined;
      
      return { type, endDate };
    } catch {
      return null;
    }
  }

  /**
   * Create recurrence rule string
   */
  createRecurrenceRule(pattern: RecurrencePattern): string {
    if (pattern.endDate) {
      return `${pattern.type};${pattern.endDate.toISOString()}`;
    }
    return pattern.type;
  }

  /**
   * Calculate all occurrences of a recurring task within a date range
   */
  calculateOccurrences(
    task: CareTask & { isRecurrenceTemplate: boolean },
    startDate: Date,
    endDate: Date
  ): VirtualTask[] {
    if (!task.recurrenceRule || !task.isRecurrenceTemplate || !task.dueDate) {
      return [];
    }

    const pattern = this.parseRecurrenceRule(task.recurrenceRule);
    if (!pattern) return [];

    const occurrences: VirtualTask[] = [];
    let currentDate = new Date(task.dueDate);
    const rangeStart = startOfDay(startDate);
    const rangeEnd = endOfDay(endDate);
    const patternEndDate = pattern.endDate ? endOfDay(pattern.endDate) : null;

    // Skip past occurrences before the range start
    while (isBefore(currentDate, rangeStart)) {
      currentDate = this.getNextOccurrence(currentDate, pattern.type);
      if (patternEndDate && isAfter(currentDate, patternEndDate)) {
        return occurrences;
      }
    }

    // Generate occurrences within the range
    while (!isAfter(currentDate, rangeEnd)) {
      if (!isBefore(currentDate, rangeStart)) {
        // Create virtual task for this occurrence
        occurrences.push({
          id: `${task.id}_virtual_${currentDate.getTime()}`,
          familyId: task.familyId,
          title: task.title,
          description: task.description,
          dueDate: new Date(currentDate),
          assignedToId: task.assignedToId,
          priority: task.priority,
          status: CareTaskStatus.PENDING,
          isVirtual: true,
          parentTaskId: task.id,
          recurrenceRule: task.recurrenceRule
        });
      }

      // Get next occurrence
      currentDate = this.getNextOccurrence(currentDate, pattern.type);
      
      // Check if we've exceeded the pattern's end date
      if (patternEndDate && isAfter(currentDate, patternEndDate)) {
        break;
      }
    }

    return occurrences;
  }

  /**
   * Calculate the next occurrence date based on recurrence type
   */
  private getNextOccurrence(currentDate: Date, type: RecurrencePattern['type']): Date {
    const time = {
      hours: currentDate.getHours(),
      minutes: currentDate.getMinutes()
    };

    switch (type) {
      case 'daily':
        return setMinutes(setHours(addDays(currentDate, 1), time.hours), time.minutes);
      
      case 'weekly':
        return setMinutes(setHours(addWeeks(currentDate, 1), time.hours), time.minutes);
      
      case 'biweekly':
        return setMinutes(setHours(addWeeks(currentDate, 2), time.hours), time.minutes);
      
      case 'monthly':
        // Handle month-end edge cases (e.g., Jan 31 -> Feb 28/29)
        const nextMonth = addMonths(currentDate, 1);
        const originalDay = getDate(currentDate);
        const daysInNextMonth = getDate(endOfDay(nextMonth));
        
        if (originalDay > daysInNextMonth) {
          // If original day doesn't exist in next month, use last day
          return setMinutes(setHours(endOfDay(nextMonth), time.hours), time.minutes);
        }
        
        return setMinutes(setHours(nextMonth, time.hours), time.minutes);
      
      default:
        throw new Error(`Unknown recurrence type: ${type}`);
    }
  }

  /**
   * Check if a task should occur on a specific date
   */
  occurrsOn(task: CareTask, date: Date): boolean {
    if (!task.recurrenceRule || !task.isRecurrenceTemplate || !task.dueDate) {
      return false;
    }

    const pattern = this.parseRecurrenceRule(task.recurrenceRule);
    if (!pattern) return false;

    const targetDate = startOfDay(date);
    const taskDate = startOfDay(task.dueDate);

    // Check if date is before task start
    if (isBefore(targetDate, taskDate)) {
      return false;
    }

    // Check if date is after pattern end
    if (pattern.endDate && isAfter(targetDate, pattern.endDate)) {
      return false;
    }

    // Check if date matches the recurrence pattern
    switch (pattern.type) {
      case 'daily':
        return true;
      
      case 'weekly':
        return getDay(targetDate) === getDay(taskDate);
      
      case 'biweekly': {
        const weeksDiff = Math.floor((targetDate.getTime() - taskDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
        return weeksDiff % 2 === 0 && getDay(targetDate) === getDay(taskDate);
      }
      
      case 'monthly':
        return getDate(targetDate) === getDate(taskDate);
      
      default:
        return false;
    }
  }

  /**
   * Create a physical task instance from a virtual occurrence
   */
  materializeOccurrence(
    parentTask: CareTask,
    occurrenceDate: Date,
    userId: string
  ): Omit<CareTask, 'id' | 'createdAt' | 'updatedAt' | 'logs' | 'assignedTo' | 'createdBy' | 'family' | 'parentTask' | 'recurrenceInstances'> {
    return {
      familyId: parentTask.familyId,
      title: parentTask.title,
      description: parentTask.description,
      dueDate: occurrenceDate,
      reminderDate: parentTask.reminderDate,
      assignedToId: parentTask.assignedToId,
      createdById: userId,
      priority: parentTask.priority,
      status: CareTaskStatus.PENDING,
      recurrenceRule: null,
      recurrenceEndDate: null,
      parentTaskId: parentTask.id,
      isRecurrenceTemplate: false
    };
  }
}

export const recurrenceService = new RecurrenceService();