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
} from '@prisma/client';

// Re-export enums as both types and values (for runtime use)
// These come from the wildcard export above, but we explicitly list them here for clarity
export {
  FamilyRole,
  InvitationStatus,
  JournalSentiment,
  CareTaskPriority,
  CareTaskStatus,
  MedicationStatus,
  DocumentType,
  ParsingStatus,
  InsightSeverity,
  UserType,
  InvitationType,
  ChecklistCategory,
  FactDomain,
  FactStatus,
  FactAssertedBy,
} from '@prisma/client';