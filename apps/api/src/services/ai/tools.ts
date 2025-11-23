import Anthropic from '@anthropic-ai/sdk';

/**
 * Shared AI Tool Definitions
 * These tools are used by both the in-app chat and onboarding AI services.
 * The tool schemas are shared, but execution handlers differ based on context.
 */

// ==================== Input Types ====================

export interface CreateJournalInput {
  content: string;
  sentiment?: 'positive' | 'neutral' | 'concerned' | 'urgent';
}

export interface CreateMedicationInput {
  name: string;
  dosage: string;
  frequency: string;
  scheduleTimes: string[];
  instructions?: string;
  startDate?: string;
}

export interface CreateCareTaskInput {
  title: string;
  description?: string;
  dueDate?: string;
  scheduledTime?: string; // NEW: Time in HH:MM format (e.g., "12:00", "14:30")
  priority?: 'high' | 'medium' | 'low';
  recurrenceType?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'once';
}

export interface CompleteCareTaskInput {
  taskId: string;
  notes?: string;
}

export interface UpdateMedicationInput {
  medicationId: string;
  isActive?: boolean;
  dosage?: string;
  frequency?: string;
  scheduleTimes?: string[];
  instructions?: string;
}

export interface AddFamilyMemberInput {
  email: string;
  name?: string;
  role: 'caregiver' | 'family_member' | 'read_only';
  relationship: string;
}

export interface CollectUserNameInput {
  name: string;
}

export interface CollectPatientInfoInput {
  firstName: string;
  lastName?: string;
  dateOfBirth?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  relationship: string;
}

export interface ReadyForDashboardInput {
  conversationSummary: string;
  dashboardWelcome: string;
}

// ==================== Tool Definitions ====================

// Journal Entry Tool
export const createJournalEntryTool: Anthropic.Tool = {
  name: 'create_journal_entry',
  description: 'Create a new journal entry to record care notes, observations, or updates about the patient. Use this when the user shares information that should be documented in the care journal.',
  input_schema: {
    type: 'object' as const,
    properties: {
      content: {
        type: 'string',
        description: "The journal entry content. Write in first person from the caregiver's perspective, summarizing what they shared. Be concise but capture key details.",
      },
      sentiment: {
        type: 'string',
        enum: ['positive', 'neutral', 'concerned', 'urgent'],
        description: 'The overall sentiment of the entry. Use "urgent" for emergencies, "concerned" for worrying observations, "positive" for good news, "neutral" for routine updates.',
      },
    },
    required: ['content'],
  },
};

// Medication Tool
export const createMedicationTool: Anthropic.Tool = {
  name: 'create_medication',
  description: "Add a new medication to the patient's medication list. Use this when the user mentions a new prescription or medication they need to track.",
  input_schema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string',
        description: 'The medication name (e.g., "Aricept", "Metformin")',
      },
      dosage: {
        type: 'string',
        description: 'The dosage amount and unit (e.g., "10mg", "500mg twice daily")',
      },
      frequency: {
        type: 'string',
        description: 'How often the medication should be taken (e.g., "twice daily", "once daily", "as needed")',
      },
      scheduleTimes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific times to take the medication in 24-hour format (e.g., ["08:00", "20:00"]). Infer from context: "morning" = "08:00", "evening" = "18:00", "night" = "21:00"',
      },
      instructions: {
        type: 'string',
        description: 'Special instructions (e.g., "take with food", "avoid grapefruit")',
      },
      startDate: {
        type: 'string',
        description: 'When to start the medication in YYYY-MM-DD format. Default to today if starting immediately, or tomorrow if mentioned.',
      },
    },
    required: ['name', 'dosage', 'frequency', 'scheduleTimes'],
  },
};

// Care Task Tool (with time support)
export const createCareTaskTool: Anthropic.Tool = {
  name: 'create_care_task',
  description: 'Create a new care task, appointment, or to-do item. Use this for appointments, errands, or tasks that need to be completed.',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: {
        type: 'string',
        description: 'A short, clear title for the task (e.g., "Pick up prescription", "Doctor appointment")',
      },
      description: {
        type: 'string',
        description: 'Additional details about the task',
      },
      dueDate: {
        type: 'string',
        description: 'When the task is due in YYYY-MM-DD format. Use "tomorrow" context to calculate correctly.',
      },
      scheduledTime: {
        type: 'string',
        description: 'The specific time for the task/appointment in HH:MM 24-hour format (e.g., "12:00" for noon, "14:30" for 2:30 PM). IMPORTANT: Always include this for appointments or time-specific tasks.',
      },
      priority: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'Task priority. Use "high" for urgent or time-sensitive tasks, "medium" for normal tasks, "low" for optional tasks.',
      },
      recurrenceType: {
        type: 'string',
        enum: ['daily', 'weekly', 'biweekly', 'monthly', 'once'],
        description: 'How often this task recurs. Use "once" for one-time tasks.',
      },
    },
    required: ['title'],
  },
};

// Complete Task Tool
export const completeCareTaskTool: Anthropic.Tool = {
  name: 'complete_care_task',
  description: "Mark a care task as completed. Use this when the user says they've finished a task.",
  input_schema: {
    type: 'object' as const,
    properties: {
      taskId: {
        type: 'string',
        description: 'The ID of the task to complete (from the context)',
      },
      notes: {
        type: 'string',
        description: 'Optional notes about the completion',
      },
    },
    required: ['taskId'],
  },
};

// Update Medication Tool
export const updateMedicationTool: Anthropic.Tool = {
  name: 'update_medication',
  description: 'Update an existing medication (change dosage, schedule, or deactivate). Use this when the user mentions changes to an existing medication.',
  input_schema: {
    type: 'object' as const,
    properties: {
      medicationId: {
        type: 'string',
        description: 'The ID of the medication to update (from the context)',
      },
      isActive: {
        type: 'boolean',
        description: 'Set to false to deactivate/stop the medication',
      },
      dosage: {
        type: 'string',
        description: 'New dosage if changed',
      },
      frequency: {
        type: 'string',
        description: 'New frequency if changed',
      },
      scheduleTimes: {
        type: 'array',
        items: { type: 'string' },
        description: 'New schedule times if changed',
      },
      instructions: {
        type: 'string',
        description: 'New instructions if changed',
      },
    },
    required: ['medicationId'],
  },
};

// Add Family Member Tool (for in-app chat - sends invite)
export const addFamilyMemberTool: Anthropic.Tool = {
  name: 'add_family_member',
  description: 'Invite a family member to join the care team. Use this when the user wants to add someone to help with care.',
  input_schema: {
    type: 'object' as const,
    properties: {
      email: {
        type: 'string',
        description: "Family member's email address",
      },
      name: {
        type: 'string',
        description: "Family member's name",
      },
      role: {
        type: 'string',
        enum: ['caregiver', 'family_member', 'read_only'],
        description: 'Access level: caregiver (full access), family_member (can view and add entries), read_only (view only)',
      },
      relationship: {
        type: 'string',
        description: 'Their relationship to the patient (e.g., daughter, son, sibling)',
      },
    },
    required: ['email', 'role', 'relationship'],
  },
};

// ==================== Onboarding-Specific Tools ====================

export const collectUserNameTool: Anthropic.Tool = {
  name: 'collect_user_name',
  description: "Collect the caregiver's name when they introduce themselves. Call this as soon as you learn their name.",
  input_schema: {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: "The caregiver's first name" },
    },
    required: ['name'],
  },
};

export const collectPatientInfoTool: Anthropic.Tool = {
  name: 'collect_patient_info',
  description: "Collect information about the patient being cared for. Call this when you have gathered enough details about the person they're caring for. You can call this with partial info and update later.",
  input_schema: {
    type: 'object' as const,
    properties: {
      firstName: { type: 'string', description: "Patient's first name" },
      lastName: { type: 'string', description: "Patient's last name (can be same as caregiver if family)" },
      dateOfBirth: { type: 'string', description: "Patient's date of birth in YYYY-MM-DD format (estimate year if only age given)" },
      gender: { type: 'string', enum: ['male', 'female', 'other'], description: "Patient's gender" },
      relationship: { type: 'string', description: 'Who the patient is to the caregiver (e.g., mother, father, spouse, grandmother). If the user says "my mom", the relationship is "mother".' },
    },
    required: ['firstName', 'lastName', 'relationship'],
  },
};

// Collect Medication Tool (for onboarding - same schema as create, but collection mode)
export const collectMedicationTool: Anthropic.Tool = {
  name: 'collect_medication',
  description: "Add a medication to the patient's list. Call this each time the user mentions a medication.",
  input_schema: {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'Medication name' },
      dosage: { type: 'string', description: 'Dosage amount and unit (e.g., "10mg", "500mg")' },
      frequency: { type: 'string', description: 'How often taken (e.g., "twice daily", "once daily", "as needed")' },
      scheduleTimes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Times of day to take medication in 24-hour format (e.g., ["08:00", "20:00"])',
      },
      instructions: { type: 'string', description: 'Special instructions (e.g., "take with food", "avoid grapefruit")' },
    },
    required: ['name', 'dosage', 'frequency', 'scheduleTimes'],
  },
};

// Collect Care Task Tool (for onboarding)
export const collectCareTaskTool: Anthropic.Tool = {
  name: 'collect_care_task',
  description: 'Add a recurring care task or appointment. Call this for regular activities like doctor appointments, therapy sessions, or daily routines.',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: 'Short title for the task' },
      description: { type: 'string', description: 'Detailed description' },
      dueDate: { type: 'string', description: 'Due date in YYYY-MM-DD format (optional)' },
      scheduledTime: {
        type: 'string',
        description: 'The specific time for the task/appointment in HH:MM 24-hour format (e.g., "12:00" for noon). Include for appointments.',
      },
      recurrenceType: {
        type: 'string',
        enum: ['daily', 'weekly', 'biweekly', 'monthly', 'once'],
        description: 'How often this task occurs',
      },
      priority: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'Task priority level',
      },
    },
    required: ['title'],
  },
};

// Collect Family Member Tool (for onboarding)
export const collectFamilyMemberTool: Anthropic.Tool = {
  name: 'collect_family_member',
  description: 'Add a family member to invite to the care team. Call this when the user mentions someone who should have access.',
  input_schema: {
    type: 'object' as const,
    properties: {
      email: { type: 'string', description: "Family member's email address" },
      name: { type: 'string', description: "Family member's name" },
      role: {
        type: 'string',
        enum: ['caregiver', 'family_member', 'read_only'],
        description: 'Access level: caregiver (full access), family_member (can view and add entries), read_only (view only)',
      },
      relationship: { type: 'string', description: 'Their relationship to the patient' },
    },
    required: ['email', 'role', 'relationship'],
  },
};

export const readyForDashboardTool: Anthropic.Tool = {
  name: 'ready_for_dashboard',
  description: "Call this when you have gathered enough information to set up the dashboard and the user seems ready to proceed. This should include at least: the patient's name and their relationship. Medications and tasks are optional.",
  input_schema: {
    type: 'object' as const,
    properties: {
      conversationSummary: {
        type: 'string',
        description: "A warm, 2-3 sentence summary of what was discussed and set up, written for a journal entry. Include who they're caring for and any key concerns mentioned.",
      },
      dashboardWelcome: {
        type: 'string',
        description: "A brief welcome message explaining what you've set up on their dashboard. Be specific about what was added.",
      },
    },
    required: ['conversationSummary', 'dashboardWelcome'],
  },
};

// ==================== Tool Sets ====================

// Tools for in-app chat (execution mode - immediately creates/updates data)
export const chatTools: Anthropic.Tool[] = [
  createJournalEntryTool,
  createMedicationTool,
  createCareTaskTool,
  completeCareTaskTool,
  updateMedicationTool,
  addFamilyMemberTool,
];

// Tools for onboarding (collection mode - gathers data for confirmation)
export const onboardingTools: Anthropic.Tool[] = [
  collectUserNameTool,
  collectPatientInfoTool,
  collectMedicationTool,
  collectCareTaskTool,
  collectFamilyMemberTool,
  readyForDashboardTool,
];

// ==================== Helper Functions ====================

/**
 * Combine a date string (YYYY-MM-DD) with a time string (HH:MM) into a Date object
 * Note: We parse the date as local time, not UTC, to avoid off-by-one day issues
 */
export function combineDateAndTime(dateStr: string, timeStr?: string): Date {
  // Parse as local date by splitting the string
  // This avoids the UTC interpretation that causes off-by-one day bugs
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day); // month is 0-indexed in JS

  if (timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
  }

  return date;
}

/**
 * Convert recurrence type to RRULE format
 */
export function recurrenceToRRule(recurrenceType?: string): string | undefined {
  if (!recurrenceType || recurrenceType === 'once') {
    return undefined;
  }

  const ruleMap: Record<string, string> = {
    daily: 'FREQ=DAILY',
    weekly: 'FREQ=WEEKLY',
    biweekly: 'FREQ=WEEKLY;INTERVAL=2',
    monthly: 'FREQ=MONTHLY',
  };

  return ruleMap[recurrenceType];
}
