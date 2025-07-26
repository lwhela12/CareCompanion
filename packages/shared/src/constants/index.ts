// Error Codes
export const ErrorCodes = {
  // Authentication
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  RESOURCE_LOCKED: 'RESOURCE_LOCKED',
  
  // Business Logic
  MEDICATION_SCHEDULE_CONFLICT: 'MEDICATION_SCHEDULE_CONFLICT',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  FAMILY_LIMIT_REACHED: 'FAMILY_LIMIT_REACHED',
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
  
  // External Services
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  INTEGRATION_ERROR: 'INTEGRATION_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

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