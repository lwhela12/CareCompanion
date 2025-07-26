export * from '@prisma/client';
export { PrismaClient } from '@prisma/client';
export { prisma } from './client';

// Re-export commonly used types
export type {
  Family,
  User,
  FamilyMember,
  Invitation,
  Patient,
  JournalEntry,
  Medication,
  MedicationLog,
  CareTask,
  CareTaskLog,
  Document,
  ItemLocation,
  Insight,
  AuditLog,
  FamilyRole,
  InvitationStatus,
  JournalSentiment,
  CareTaskPriority,
  CareTaskStatus,
  MedicationStatus,
  DocumentType,
  ParsingStatus,
  InsightSeverity,
} from '@prisma/client';