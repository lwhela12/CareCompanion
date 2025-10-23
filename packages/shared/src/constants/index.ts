// Subscription Tiers
export const SubscriptionTiers = {
  FREE: 'free',
  BASIC: 'basic',
  PREMIUM: 'premium',
  ENTERPRISE: 'enterprise',
} as const;

// API Limits
export const ApiLimits = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_JOURNAL_LENGTH: 5000,
  MAX_TASK_TITLE_LENGTH: 255,
  MAX_MEDICATION_NAME_LENGTH: 255,
} as const;

// Time Constants
export const TimeConstants = {
  SESSION_DURATION: 24 * 60 * 60 * 1000, // 24 hours
  CACHE_TTL: 60 * 60, // 1 hour in seconds
  MEDICATION_REMINDER_WINDOW: 30 * 60 * 1000, // 30 minutes
  INSIGHT_RETENTION_DAYS: 90,
} as const;

// Medication Routes
export const MedicationRoutes = {
  ORAL: 'oral',
  INJECTION: 'injection',
  TOPICAL: 'topical',
  INHALATION: 'inhalation',
  SUBLINGUAL: 'sublingual',
  RECTAL: 'rectal',
  TRANSDERMAL: 'transdermal',
  OTHER: 'other',
} as const;

// Care Task Categories
export const CareTaskCategories = {
  HYGIENE: 'hygiene',
  MEALS: 'meals',
  MEDICATION: 'medication',
  EXERCISE: 'exercise',
  MEDICAL: 'medical',
  SOCIAL: 'social',
  HOUSEHOLD: 'household',
  OTHER: 'other',
} as const;