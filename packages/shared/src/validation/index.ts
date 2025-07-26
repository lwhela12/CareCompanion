import { z } from 'zod';

// Common validation schemas
export const emailSchema = z.string().email('Invalid email address');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const phoneSchema = z
  .string()
  .regex(/^\+?1?\d{10,14}$/, 'Invalid phone number');

export const dateSchema = z.string().datetime();

export const uuidSchema = z.string().uuid();

// Pagination schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  cursor: z.string().optional(),
});

// User schemas
export const createUserSchema = z.object({
  email: emailSchema,
  name: z.string().min(1).max(255),
  role: z.enum(['admin', 'care_coordinator', 'family_member', 'view_only']),
});

// Patient schemas
export const createPatientSchema = z.object({
  name: z.string().min(1).max(255),
  dateOfBirth: z.string().datetime().optional(),
  medicalRecordNumber: z.string().max(100).optional(),
  primaryCaregiverId: uuidSchema.optional(),
});

// Journal entry schemas
export const createJournalEntrySchema = z.object({
  patientId: uuidSchema,
  content: z.string().min(1).max(5000),
  voiceTranscript: z.string().optional(),
  privacyLevel: z.enum(['private', 'family']).default('family'),
  tags: z.array(z.string()).optional(),
});

// Medication schemas
export const createMedicationSchema = z.object({
  patientId: uuidSchema,
  name: z.string().min(1).max(255),
  genericName: z.string().max(255).optional(),
  dosage: z.string().max(100).optional(),
  frequency: z.string().max(100).optional(),
  route: z.string().max(50).optional(),
  prescriber: z.string().max(255).optional(),
  pharmacy: z.string().max(255).optional(),
  startDate: dateSchema,
  endDate: dateSchema.optional(),
  refillsRemaining: z.number().int().min(0).optional(),
  instructions: z.string().optional(),
});

// Medication log schemas
export const createMedicationLogSchema = z.object({
  medicationId: uuidSchema,
  scheduledTime: dateSchema,
  givenTime: dateSchema.optional(),
  status: z.enum(['given', 'missed', 'refused', 'scheduled']),
  notes: z.string().optional(),
});

// Care task schemas
export const createCareTaskSchema = z.object({
  patientId: uuidSchema,
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.string().max(50).optional(),
  recurrenceRule: z.string().optional(),
  assignedToUserId: uuidSchema.optional(),
});

// Document upload schema
export const uploadDocumentSchema = z.object({
  patientId: uuidSchema,
  type: z.enum(['medical_record', 'financial', 'legal', 'insurance', 'other']),
  title: z.string().min(1).max(255),
});

// Query validation schemas
export const dateRangeSchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
}).refine(
  (data) => new Date(data.startDate) <= new Date(data.endDate),
  'Start date must be before or equal to end date'
);

export const medicationQuerySchema = z.object({
  patientId: uuidSchema,
  active: z.coerce.boolean().optional(),
});

export const journalQuerySchema = z.object({
  patientId: uuidSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  privacyLevel: z.enum(['private', 'family']).optional(),
});

// Type exports
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
export type CreateMedicationInput = z.infer<typeof createMedicationSchema>;
export type CreateMedicationLogInput = z.infer<typeof createMedicationLogSchema>;
export type CreateCareTaskInput = z.infer<typeof createCareTaskSchema>;
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type PaginationParams = z.infer<typeof paginationSchema>;
export type DateRangeParams = z.infer<typeof dateRangeSchema>;