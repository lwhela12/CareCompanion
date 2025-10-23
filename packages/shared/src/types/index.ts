export * from './errors';

// API Response Types
export interface ApiResponse<T = any> {
  data?: T;
  error?: ApiError;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  requestId?: string;
}

// Pagination
export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  hasNextPage: boolean;
  total?: number;
}

// Date Range
export interface DateRange {
  start: Date | string;
  end: Date | string;
}

// Summary Types
export interface DailySummary {
  familyId: string;
  patientId: string;
  date: string;
  medicationAdherence: {
    given: number;
    missed: number;
    rate: number;
  };
  journalEntries: {
    count: number;
    sentiment: 'positive' | 'neutral' | 'concerned' | 'urgent';
    keyTopics: string[];
  };
  careTasks: {
    completed: number;
    pending: number;
  };
  insights: {
    new: number;
    unacknowledged: number;
  };
}

// AI Analysis Types
export interface JournalAnalysis {
  sentiment: 'positive' | 'neutral' | 'concerned' | 'urgent';
  keyTopics: string[];
  cognitiveIndicators: string[];
  physicalHealth: string[];
  actionItems: string[];
  privacyConcerns: string[];
}

export interface PatternDetectionResult {
  type: string;
  significance: number;
  title: string;
  description: string;
  data: Record<string, any>;
  recommendations: string[];
}

// Medication Adherence
export interface MedicationAdherenceReport {
  patientId: string;
  period: DateRange;
  medications: Array<{
    id: string;
    name: string;
    adherenceRate: number;
    missedDoses: Array<{
      scheduledTime: Date;
      reason?: string;
    }>;
  }>;
  overallRate: number;
  trends: Array<{
    date: string;
    rate: number;
  }>;
}