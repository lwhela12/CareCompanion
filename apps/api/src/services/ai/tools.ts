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
  isPrivate?: boolean;
}

export interface UpdateJournalEntryInput {
  entryId: string;
  content?: string;
  sentiment?: 'positive' | 'neutral' | 'concerned' | 'urgent';
  isPrivate?: boolean;
}

export interface DeleteJournalEntryInput {
  entryId: string;
}

// Nutrition/Meal tools
export interface LogMealInput {
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'OTHER';
  notes?: string;
  consumedAt?: string; // ISO datetime
}

export interface UpdateMealInput {
  mealLogId: string;
  mealType?: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'OTHER';
  notes?: string;
}

export interface DeleteMealInput {
  mealLogId: string;
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
  scheduledTime?: string; // Time in HH:MM format (e.g., "12:00", "14:30")
  dayOfWeek?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'; // For weekly recurring tasks
  priority?: 'high' | 'medium' | 'low';
  taskType?: 'task' | 'appointment'; // Distinguishes tasks from appointments
  recurrenceType?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'once';
}

export interface CompleteCareTaskInput {
  taskId: string;
  notes?: string;
}

export interface UpdateCareTaskInput {
  taskId: string;
  title?: string;
  description?: string;
  dueDate?: string;
  scheduledTime?: string;
  assignedToId?: string | null;
  priority?: 'high' | 'medium' | 'low';
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

export interface DeleteCareTaskInput {
  taskId: string;
}

export interface UpdateMedicationInput {
  medicationId: string;
  isActive?: boolean;
  dosage?: string;
  frequency?: string;
  scheduleTimes?: string[];
  instructions?: string;
}

export interface LogMedicationDoseInput {
  medicationId: string;
  scheduledTime: string; // ISO datetime or HH:MM format
  status: 'given' | 'missed' | 'refused';
  notes?: string;
}

export interface RefillMedicationInput {
  medicationId: string;
  pillsAdded: number;
  refillDate?: string; // YYYY-MM-DD format
}

export interface DeleteMedicationInput {
  medicationId: string;
}

export interface AddFamilyMemberInput {
  email: string;
  name?: string;
  role: 'caregiver' | 'family_member' | 'read_only';
  relationship: string;
}

// Recommendation tools
export interface AcknowledgeRecommendationInput {
  recommendationId: string;
}

export interface AcceptRecommendationInput {
  recommendationId: string;
  notes?: string;
}

export interface DismissRecommendationInput {
  recommendationId: string;
  reason: string;
}

// Fact tools
export interface ConfirmFactInput {
  factId: string;
}

export interface RejectFactInput {
  factId: string;
  reason?: string;
}

export interface PinFactInput {
  factId: string;
  pinned: boolean;
}

// Provider tools
export interface CreateProviderInput {
  name: string;
  type?: 'physician' | 'specialist' | 'therapist' | 'pharmacist' | 'facility' | 'other';
  specialty?: string;
  phone?: string;
  email?: string;
  fax?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  facility?: string;
  department?: string;
  notes?: string;
  isPrimary?: boolean;
}

export interface UpdateProviderInput {
  providerId: string;
  name?: string;
  type?: 'physician' | 'specialist' | 'therapist' | 'pharmacist' | 'facility' | 'other';
  specialty?: string;
  phone?: string;
  email?: string;
  fax?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  facility?: string;
  department?: string;
  notes?: string;
  isPrimary?: boolean;
  isActive?: boolean;
}

export interface DeleteProviderInput {
  providerId: string;
}

// Checklist tools
export interface CreateChecklistItemInput {
  title: string;
  description?: string;
  category: 'meals' | 'medication' | 'exercise' | 'hygiene' | 'social' | 'therapy' | 'other';
  scheduledTime?: string; // HH:MM format
}

export interface UpdateChecklistItemInput {
  itemId: string;
  title?: string;
  description?: string;
  category?: 'meals' | 'medication' | 'exercise' | 'hygiene' | 'social' | 'therapy' | 'other';
  scheduledTime?: string;
  isActive?: boolean;
}

export interface DeleteChecklistItemInput {
  itemId: string;
}

export interface LogChecklistCompletionInput {
  itemId: string;
  notes?: string;
}

// Document tools
export interface SearchDocumentsInput {
  query: string;
  documentType?: 'medical_record' | 'financial' | 'legal' | 'insurance' | 'other';
}

export interface GetDocumentDetailsInput {
  documentId: string;
}

export interface TriggerDocumentParseInput {
  documentId: string;
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

// Update Journal Entry Tool
export const updateJournalEntryTool: Anthropic.Tool = {
  name: 'update_journal_entry',
  description: 'Update an existing journal entry. Use this to edit content, change sentiment, or toggle privacy.',
  input_schema: {
    type: 'object' as const,
    properties: {
      entryId: {
        type: 'string',
        description: 'The ID of the journal entry to update (from the context)',
      },
      content: {
        type: 'string',
        description: 'New content if changing',
      },
      sentiment: {
        type: 'string',
        enum: ['positive', 'neutral', 'concerned', 'urgent'],
        description: 'New sentiment if changing',
      },
      isPrivate: {
        type: 'boolean',
        description: 'Set privacy status (true = private, false = visible to care team)',
      },
    },
    required: ['entryId'],
  },
};

// Delete Journal Entry Tool
export const deleteJournalEntryTool: Anthropic.Tool = {
  name: 'delete_journal_entry',
  description: 'Delete a journal entry. Use this when the user wants to remove an entry.',
  input_schema: {
    type: 'object' as const,
    properties: {
      entryId: {
        type: 'string',
        description: 'The ID of the journal entry to delete (from the context)',
      },
    },
    required: ['entryId'],
  },
};

// Log Meal Tool
export const logMealTool: Anthropic.Tool = {
  name: 'log_meal',
  description: 'Log a meal for the patient with automatic nutrition estimation. Use this when the user mentions what the patient ate (e.g., "mom had oatmeal for breakfast"). Include as much detail as possible about the foods and portions to get accurate calorie and macro estimates.',
  input_schema: {
    type: 'object' as const,
    properties: {
      mealType: {
        type: 'string',
        enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'OTHER'],
        description: 'Type of meal: BREAKFAST (morning), LUNCH (midday), DINNER (evening), SNACK, or OTHER',
      },
      notes: {
        type: 'string',
        description: 'Detailed description of what was eaten, including portion sizes when mentioned. Be specific about all food items (e.g., "1 cup oatmeal with sliced banana and 1 tbsp honey, glass of orange juice"). The more detail provided, the more accurate the nutrition estimates.',
      },
      consumedAt: {
        type: 'string',
        description: 'When the meal was eaten in ISO datetime format. Defaults to now if not specified.',
      },
    },
    required: ['mealType'],
  },
};

// Update Meal Tool
export const updateMealTool: Anthropic.Tool = {
  name: 'update_meal',
  description: 'Update an existing meal log. Use this to correct meal details.',
  input_schema: {
    type: 'object' as const,
    properties: {
      mealLogId: {
        type: 'string',
        description: 'The ID of the meal log to update (from the context)',
      },
      mealType: {
        type: 'string',
        enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'OTHER'],
        description: 'New meal type if changing',
      },
      notes: {
        type: 'string',
        description: 'New meal description if changing',
      },
    },
    required: ['mealLogId'],
  },
};

// Delete Meal Tool
export const deleteMealTool: Anthropic.Tool = {
  name: 'delete_meal',
  description: 'Delete a meal log. Use this when the user wants to remove a meal entry.',
  input_schema: {
    type: 'object' as const,
    properties: {
      mealLogId: {
        type: 'string',
        description: 'The ID of the meal log to delete (from the context)',
      },
    },
    required: ['mealLogId'],
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
      taskType: {
        type: 'string',
        enum: ['task', 'appointment'],
        description: 'The type of item. Use "appointment" for doctor visits, therapy sessions, or other fixed-time commitments. Use "task" for to-do items like picking up prescriptions or completing errands.',
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

// Update Care Task Tool
export const updateCareTaskTool: Anthropic.Tool = {
  name: 'update_care_task',
  description: 'Update an existing care task or appointment. Use this to reschedule, reassign, or modify task details.',
  input_schema: {
    type: 'object' as const,
    properties: {
      taskId: {
        type: 'string',
        description: 'The ID of the task to update (from the context)',
      },
      title: {
        type: 'string',
        description: 'New title if changing',
      },
      description: {
        type: 'string',
        description: 'New description if changing',
      },
      dueDate: {
        type: 'string',
        description: 'New due date in YYYY-MM-DD format',
      },
      scheduledTime: {
        type: 'string',
        description: 'New scheduled time in HH:MM 24-hour format',
      },
      assignedToId: {
        type: 'string',
        description: 'ID of family member to assign to, or null to unassign',
      },
      priority: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'New priority level',
      },
      status: {
        type: 'string',
        enum: ['pending', 'in_progress', 'completed', 'cancelled'],
        description: 'New status',
      },
    },
    required: ['taskId'],
  },
};

// Delete Care Task Tool
export const deleteCareTaskTool: Anthropic.Tool = {
  name: 'delete_care_task',
  description: 'Delete or cancel a care task. Use this when the user wants to remove a task.',
  input_schema: {
    type: 'object' as const,
    properties: {
      taskId: {
        type: 'string',
        description: 'The ID of the task to delete (from the context)',
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

// Log Medication Dose Tool
export const logMedicationDoseTool: Anthropic.Tool = {
  name: 'log_medication_dose',
  description: 'Log that a medication dose was given, missed, or refused. Use this when the user says they gave a medication, or that it was missed/refused.',
  input_schema: {
    type: 'object' as const,
    properties: {
      medicationId: {
        type: 'string',
        description: 'The ID of the medication (from the context)',
      },
      scheduledTime: {
        type: 'string',
        description: 'When the dose was scheduled, in ISO datetime format or today\'s date with time (e.g., "2025-01-15T08:00:00" or just "08:00" for today)',
      },
      status: {
        type: 'string',
        enum: ['given', 'missed', 'refused'],
        description: 'Whether the medication was given, missed, or refused by the patient',
      },
      notes: {
        type: 'string',
        description: 'Optional notes about this dose (e.g., "patient feeling nauseous", "taken 30 minutes late")',
      },
    },
    required: ['medicationId', 'scheduledTime', 'status'],
  },
};

// Refill Medication Tool
export const refillMedicationTool: Anthropic.Tool = {
  name: 'refill_medication',
  description: 'Record a medication refill. Use this when the user picks up a prescription or adds to their medication supply.',
  input_schema: {
    type: 'object' as const,
    properties: {
      medicationId: {
        type: 'string',
        description: 'The ID of the medication (from the context)',
      },
      pillsAdded: {
        type: 'number',
        description: 'Number of pills/doses added to the supply',
      },
      refillDate: {
        type: 'string',
        description: 'Date of the refill in YYYY-MM-DD format. Defaults to today if not specified.',
      },
    },
    required: ['medicationId', 'pillsAdded'],
  },
};

// Delete Medication Tool
export const deleteMedicationTool: Anthropic.Tool = {
  name: 'delete_medication',
  description: 'Deactivate/remove a medication from tracking. Use this when the user says to stop tracking a medication or it\'s been discontinued.',
  input_schema: {
    type: 'object' as const,
    properties: {
      medicationId: {
        type: 'string',
        description: 'The ID of the medication to remove (from the context)',
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

// ==================== Recommendation Tools ====================

// Acknowledge Recommendation Tool
export const acknowledgeRecommendationTool: Anthropic.Tool = {
  name: 'acknowledge_recommendation',
  description: 'Mark a recommendation as acknowledged/reviewed. Use this when the user has seen or reviewed a recommendation.',
  input_schema: {
    type: 'object' as const,
    properties: {
      recommendationId: {
        type: 'string',
        description: 'The ID of the recommendation to acknowledge (from the context)',
      },
    },
    required: ['recommendationId'],
  },
};

// Accept Recommendation Tool
export const acceptRecommendationTool: Anthropic.Tool = {
  name: 'accept_recommendation',
  description: 'Accept a recommendation and begin implementing it. This may create linked entities (medication, task, checklist item). Use this when the user agrees to follow a recommendation.',
  input_schema: {
    type: 'object' as const,
    properties: {
      recommendationId: {
        type: 'string',
        description: 'The ID of the recommendation to accept (from the context)',
      },
      notes: {
        type: 'string',
        description: 'Optional notes about implementation plans',
      },
    },
    required: ['recommendationId'],
  },
};

// Dismiss Recommendation Tool
export const dismissRecommendationTool: Anthropic.Tool = {
  name: 'dismiss_recommendation',
  description: 'Dismiss a recommendation with a reason. Use this when the user decides not to follow a recommendation.',
  input_schema: {
    type: 'object' as const,
    properties: {
      recommendationId: {
        type: 'string',
        description: 'The ID of the recommendation to dismiss (from the context)',
      },
      reason: {
        type: 'string',
        description: 'Reason for dismissing (e.g., "already doing this", "not applicable", "doctor advised against")',
      },
    },
    required: ['recommendationId', 'reason'],
  },
};

// List Recommendations Tool
export const listRecommendationsTool: Anthropic.Tool = {
  name: 'list_recommendations',
  description: 'List recommendations with optional filters. Use this when the user asks about pending recommendations, wants to see what needs attention, or asks "what should I do?".',
  input_schema: {
    type: 'object' as const,
    properties: {
      status: {
        type: 'string',
        enum: ['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED'],
        description: 'Filter by status. Omit to see pending and in_progress by default.',
      },
      type: {
        type: 'string',
        enum: ['MEDICATION', 'EXERCISE', 'DIET', 'THERAPY', 'LIFESTYLE', 'MONITORING', 'FOLLOWUP', 'TESTS'],
        description: 'Filter by recommendation type.',
      },
      priority: {
        type: 'string',
        enum: ['URGENT', 'HIGH', 'MEDIUM', 'LOW'],
        description: 'Filter by priority level.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of recommendations to return. Always provide this - use 10 if not specified by user.',
      },
    },
    required: ['limit'],
  },
};

// Get Recommendation Details Tool
export const getRecommendationDetailsTool: Anthropic.Tool = {
  name: 'get_recommendation_details',
  description: 'Get full details of a specific recommendation including linked document, provider, and visit info. Use this when the user wants more information about a specific recommendation.',
  input_schema: {
    type: 'object' as const,
    properties: {
      recommendationId: {
        type: 'string',
        description: 'The ID of the recommendation to get details for',
      },
    },
    required: ['recommendationId'],
  },
};

// Create Recommendation Tool
export const createRecommendationTool: Anthropic.Tool = {
  name: 'create_recommendation',
  description: 'Create a new recommendation for the patient. Use this when the user mentions something that should be tracked or followed up on, or when you want to suggest an action based on the conversation.',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: {
        type: 'string',
        description: 'Short title for the recommendation (e.g., "Schedule follow-up with cardiologist")',
      },
      description: {
        type: 'string',
        description: 'Detailed description of what should be done',
      },
      type: {
        type: 'string',
        enum: ['MEDICATION', 'EXERCISE', 'DIET', 'THERAPY', 'LIFESTYLE', 'MONITORING', 'FOLLOWUP', 'TESTS'],
        description: 'Category of recommendation',
      },
      priority: {
        type: 'string',
        enum: ['URGENT', 'HIGH', 'MEDIUM', 'LOW'],
        description: 'Priority level. Use URGENT sparingly for time-sensitive medical needs.',
      },
    },
    required: ['title', 'type', 'priority'],
  },
};

// Complete Recommendation Tool
export const completeRecommendationTool: Anthropic.Tool = {
  name: 'complete_recommendation',
  description: 'Mark a recommendation as completed/done. Use this when the user says they have finished implementing a recommendation.',
  input_schema: {
    type: 'object' as const,
    properties: {
      recommendationId: {
        type: 'string',
        description: 'The ID of the recommendation to complete',
      },
      notes: {
        type: 'string',
        description: 'Optional notes about how the recommendation was completed',
      },
    },
    required: ['recommendationId'],
  },
};

// Input types for new recommendation tools
export type ListRecommendationsInput = {
  status?: 'PENDING' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'COMPLETED' | 'DISMISSED';
  type?: 'MEDICATION' | 'EXERCISE' | 'DIET' | 'THERAPY' | 'LIFESTYLE' | 'MONITORING' | 'FOLLOWUP' | 'TESTS';
  priority?: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  limit?: number;
};

export type GetRecommendationDetailsInput = {
  recommendationId: string;
};

export type CreateRecommendationInput = {
  title: string;
  description?: string;
  type: 'MEDICATION' | 'EXERCISE' | 'DIET' | 'THERAPY' | 'LIFESTYLE' | 'MONITORING' | 'FOLLOWUP' | 'TESTS';
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
};

export type CompleteRecommendationInput = {
  recommendationId: string;
  notes?: string;
};

// ==================== Fact Tools ====================

// Confirm Fact Tool
export const confirmFactTool: Anthropic.Tool = {
  name: 'confirm_fact',
  description: 'Confirm a proposed fact as accurate. Changes status from PROPOSED to ACTIVE. Use this when the user confirms an AI-extracted fact is correct.',
  input_schema: {
    type: 'object' as const,
    properties: {
      factId: {
        type: 'string',
        description: 'The ID of the fact to confirm (from the context)',
      },
    },
    required: ['factId'],
  },
};

// Reject Fact Tool
export const rejectFactTool: Anthropic.Tool = {
  name: 'reject_fact',
  description: 'Reject a proposed fact as inaccurate. Use this when the user says an AI-extracted fact is wrong.',
  input_schema: {
    type: 'object' as const,
    properties: {
      factId: {
        type: 'string',
        description: 'The ID of the fact to reject (from the context)',
      },
      reason: {
        type: 'string',
        description: 'Optional reason why the fact is incorrect',
      },
    },
    required: ['factId'],
  },
};

// Pin Fact Tool
export const pinFactTool: Anthropic.Tool = {
  name: 'pin_fact',
  description: 'Pin or unpin a fact for quick reference. Pinned facts appear prominently. Use this when the user wants to highlight important information.',
  input_schema: {
    type: 'object' as const,
    properties: {
      factId: {
        type: 'string',
        description: 'The ID of the fact to pin/unpin (from the context)',
      },
      pinned: {
        type: 'boolean',
        description: 'Set to true to pin, false to unpin',
      },
    },
    required: ['factId', 'pinned'],
  },
};

// ==================== Provider Tools ====================

// Create Provider Tool
export const createProviderTool: Anthropic.Tool = {
  name: 'create_provider',
  description: 'Add a new healthcare provider (doctor, specialist, therapist, etc). Use this when the user mentions a new doctor or healthcare provider.',
  input_schema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string',
        description: 'Provider\'s name (e.g., "Dr. Smith", "Memorial Hospital")',
      },
      type: {
        type: 'string',
        enum: ['physician', 'specialist', 'therapist', 'pharmacist', 'facility', 'other'],
        description: 'Type of provider: physician (general doctor), specialist (cardiologist, neurologist, etc), therapist, pharmacist, facility (hospital, clinic), or other',
      },
      specialty: {
        type: 'string',
        description: 'Medical specialty (e.g., "Cardiology", "Neurology", "Primary Care")',
      },
      phone: {
        type: 'string',
        description: 'Phone number',
      },
      email: {
        type: 'string',
        description: 'Email address',
      },
      fax: {
        type: 'string',
        description: 'Fax number',
      },
      address: {
        type: 'string',
        description: 'Street address',
      },
      city: {
        type: 'string',
        description: 'City',
      },
      state: {
        type: 'string',
        description: 'State (2-letter code)',
      },
      zipCode: {
        type: 'string',
        description: 'ZIP code',
      },
      facility: {
        type: 'string',
        description: 'Hospital or clinic name where they practice',
      },
      department: {
        type: 'string',
        description: 'Department within the facility',
      },
      notes: {
        type: 'string',
        description: 'Additional notes about the provider',
      },
      isPrimary: {
        type: 'boolean',
        description: 'Set to true if this is the primary care physician',
      },
    },
    required: ['name'],
  },
};

// Update Provider Tool
export const updateProviderTool: Anthropic.Tool = {
  name: 'update_provider',
  description: 'Update an existing provider\'s information. Use this to change contact info, specialty, or other details.',
  input_schema: {
    type: 'object' as const,
    properties: {
      providerId: {
        type: 'string',
        description: 'The ID of the provider to update (from the context)',
      },
      name: {
        type: 'string',
        description: 'New name if changing',
      },
      type: {
        type: 'string',
        enum: ['physician', 'specialist', 'therapist', 'pharmacist', 'facility', 'other'],
        description: 'New provider type if changing',
      },
      specialty: {
        type: 'string',
        description: 'New specialty if changing',
      },
      phone: {
        type: 'string',
        description: 'New phone number if changing',
      },
      email: {
        type: 'string',
        description: 'New email if changing',
      },
      fax: {
        type: 'string',
        description: 'New fax number if changing',
      },
      address: {
        type: 'string',
        description: 'New street address if changing',
      },
      city: {
        type: 'string',
        description: 'New city if changing',
      },
      state: {
        type: 'string',
        description: 'New state if changing',
      },
      zipCode: {
        type: 'string',
        description: 'New ZIP code if changing',
      },
      facility: {
        type: 'string',
        description: 'New facility name if changing',
      },
      department: {
        type: 'string',
        description: 'New department if changing',
      },
      notes: {
        type: 'string',
        description: 'New notes if changing',
      },
      isPrimary: {
        type: 'boolean',
        description: 'Set primary care physician status',
      },
      isActive: {
        type: 'boolean',
        description: 'Set to false to deactivate the provider',
      },
    },
    required: ['providerId'],
  },
};

// Delete Provider Tool
export const deleteProviderTool: Anthropic.Tool = {
  name: 'delete_provider',
  description: 'Remove a provider from tracking. Use this when the user no longer sees a provider.',
  input_schema: {
    type: 'object' as const,
    properties: {
      providerId: {
        type: 'string',
        description: 'The ID of the provider to remove (from the context)',
      },
    },
    required: ['providerId'],
  },
};

// ==================== Checklist Tools ====================

// Create Checklist Item Tool
export const createChecklistItemTool: Anthropic.Tool = {
  name: 'create_checklist_item',
  description: 'Add a new daily checklist item for the patient. Use this for recurring daily activities like bathing, exercise, or social activities.',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: {
        type: 'string',
        description: 'Name of the checklist item (e.g., "Morning bath", "Physical therapy exercises")',
      },
      description: {
        type: 'string',
        description: 'Additional details or instructions',
      },
      category: {
        type: 'string',
        enum: ['meals', 'medication', 'exercise', 'hygiene', 'social', 'therapy', 'other'],
        description: 'Category of the activity',
      },
      scheduledTime: {
        type: 'string',
        description: 'Time of day in HH:MM 24-hour format (e.g., "09:00" for 9 AM)',
      },
    },
    required: ['title', 'category'],
  },
};

// Update Checklist Item Tool
export const updateChecklistItemTool: Anthropic.Tool = {
  name: 'update_checklist_item',
  description: 'Update an existing checklist item. Use this to change details, time, or category.',
  input_schema: {
    type: 'object' as const,
    properties: {
      itemId: {
        type: 'string',
        description: 'The ID of the checklist item to update (from the context)',
      },
      title: {
        type: 'string',
        description: 'New title if changing',
      },
      description: {
        type: 'string',
        description: 'New description if changing',
      },
      category: {
        type: 'string',
        enum: ['meals', 'medication', 'exercise', 'hygiene', 'social', 'therapy', 'other'],
        description: 'New category if changing',
      },
      scheduledTime: {
        type: 'string',
        description: 'New scheduled time if changing (HH:MM format)',
      },
      isActive: {
        type: 'boolean',
        description: 'Set to false to deactivate the checklist item',
      },
    },
    required: ['itemId'],
  },
};

// Delete Checklist Item Tool
export const deleteChecklistItemTool: Anthropic.Tool = {
  name: 'delete_checklist_item',
  description: 'Remove a checklist item. Use this when the user no longer needs to track an activity.',
  input_schema: {
    type: 'object' as const,
    properties: {
      itemId: {
        type: 'string',
        description: 'The ID of the checklist item to remove (from the context)',
      },
    },
    required: ['itemId'],
  },
};

// Log Checklist Completion Tool
export const logChecklistCompletionTool: Anthropic.Tool = {
  name: 'log_checklist_completion',
  description: 'Mark a checklist item as completed for today. Use this when the user says they did something on the checklist.',
  input_schema: {
    type: 'object' as const,
    properties: {
      itemId: {
        type: 'string',
        description: 'The ID of the checklist item completed (from the context)',
      },
      notes: {
        type: 'string',
        description: 'Optional notes about how it went (e.g., "Was more cooperative today")',
      },
    },
    required: ['itemId'],
  },
};

// ==================== Document Tools ====================

// Search Documents Tool
export const searchDocumentsTool: Anthropic.Tool = {
  name: 'search_documents',
  description: 'Search through uploaded documents by keywords or content. Use this when the user asks about documents, medical records, or uploaded files.',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Search query (e.g., "blood test results", "insurance card", "medication list")',
      },
      documentType: {
        type: 'string',
        enum: ['medical_record', 'financial', 'legal', 'insurance', 'other'],
        description: 'Filter by document type (optional)',
      },
    },
    required: ['query'],
  },
};

// Get Document Details Tool
export const getDocumentDetailsTool: Anthropic.Tool = {
  name: 'get_document_details',
  description: 'Get detailed information about a specific document including its parsed content. Use this after searching to get more details.',
  input_schema: {
    type: 'object' as const,
    properties: {
      documentId: {
        type: 'string',
        description: 'The ID of the document (from search results or context)',
      },
    },
    required: ['documentId'],
  },
};

// Trigger Document Parse Tool
export const triggerDocumentParseTool: Anthropic.Tool = {
  name: 'trigger_document_parse',
  description: 'Trigger AI parsing of a document that has not been parsed yet. Use this when a document shows parsing status as pending.',
  input_schema: {
    type: 'object' as const,
    properties: {
      documentId: {
        type: 'string',
        description: 'The ID of the document to parse (from context)',
      },
    },
    required: ['documentId'],
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
        description: 'The specific time for the task/appointment in HH:MM 24-hour format (e.g., "11:00" for 11 AM). Include for appointments.',
      },
      dayOfWeek: {
        type: 'string',
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        description: 'For weekly recurring tasks, which day of the week (e.g., "wednesday" for therapy on Wednesdays)',
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
  updateJournalEntryTool,
  deleteJournalEntryTool,
  logMealTool,
  updateMealTool,
  deleteMealTool,
  createMedicationTool,
  createCareTaskTool,
  completeCareTaskTool,
  updateCareTaskTool,
  deleteCareTaskTool,
  updateMedicationTool,
  logMedicationDoseTool,
  refillMedicationTool,
  deleteMedicationTool,
  addFamilyMemberTool,
  // Recommendation tools
  listRecommendationsTool,
  getRecommendationDetailsTool,
  createRecommendationTool,
  acknowledgeRecommendationTool,
  acceptRecommendationTool,
  dismissRecommendationTool,
  completeRecommendationTool,
  // Fact tools
  confirmFactTool,
  rejectFactTool,
  pinFactTool,
  // Provider tools
  createProviderTool,
  updateProviderTool,
  deleteProviderTool,
  // Checklist tools
  createChecklistItemTool,
  updateChecklistItemTool,
  deleteChecklistItemTool,
  logChecklistCompletionTool,
  // Document tools
  searchDocumentsTool,
  getDocumentDetailsTool,
  triggerDocumentParseTool,
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
