# CareCompanion Technical Design Document

## 1. System Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Client    │     │  Mobile Client  │     │  Voice Client   │
│    (React)      │     │   (Future)      │     │ (Web Speech API)│
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                         │
         └───────────────────────┴─────────────────────────┘
                                 │
                         ┌───────▼────────┐
                         │   CloudFlare   │
                         │   CDN/WAF       │
                         └───────┬────────┘
                                 │
                         ┌───────▼────────┐
                         │  Load Balancer  │
                         │   (AWS ALB)     │
                         └───────┬────────┘
                                 │
         ┌───────────────────────┴─────────────────────────┐
         │                                                   │
┌────────▼────────┐     ┌─────────────────┐     ┌──────────▼────────┐
│   API Gateway   │     │  Auth Service   │     │  Background Jobs  │
│  (Express.js)   │────▶│ (Clerk/Auth0)   │     │  (BullMQ/Redis)   │
└────────┬────────┘     └─────────────────┘     └──────────┬────────┘
         │                                                   │
         ├───────────────────────┬───────────────────────────┤
         │                       │                           │
┌────────▼────────┐     ┌────────▼────────┐     ┌──────────▼────────┐
│  Core Services  │     │   AI Services   │     │ Integration Layer │
│  (Business      │     │  (LLM, OCR,     │     │ (Calendar, Bank,  │
│   Logic)        │     │   Patterns)     │     │  Medical APIs)    │
└────────┬────────┘     └────────┬────────┘     └──────────┬────────┘
         │                       │                           │
         └───────────────────────┴───────────────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
         ┌───────▼────────┐            ┌─────────▼────────┐
         │  PostgreSQL    │            │   S3 Storage     │
         │  (Primary DB)  │            │  (Documents)     │
         └────────────────┘            └──────────────────┘
```

### 1.2 Technology Stack

**Frontend:**
- React 18+ with TypeScript
- Tailwind CSS for styling
- React Query for data fetching
- Zustand for state management
- React Hook Form for form handling
- Web Speech API for voice input

**Backend:**
- Node.js 20+ with TypeScript
- Express.js for API framework
- Prisma as ORM
- BullMQ for job queues
- Redis for caching and sessions

**Infrastructure:**
- AWS (EC2, RDS, S3, CloudFront)
- Docker containers
- GitHub Actions for CI/CD
- Sentry for error monitoring
- DataDog for APM

**AI/ML:**
- OpenAI GPT-4 for text analysis
- Whisper API for speech-to-text
- AWS Textract for OCR
- Custom prompt engineering layer

## 2. Database Design

### 2.1 PostgreSQL Schema

```sql
-- Core Tables
CREATE TABLE families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    subscription_tier VARCHAR(50) DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES families(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'care_coordinator', 'family_member', 'view_only')),
    auth_provider_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP WITH TIME ZONE,
    INDEX idx_users_family_id (family_id),
    INDEX idx_users_email (email)
);

CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES families(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    date_of_birth DATE,
    primary_caregiver_id UUID REFERENCES users(id),
    medical_record_number VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_patients_family_id (family_id)
);

-- Journaling Tables
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES families(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id),
    content TEXT NOT NULL,
    content_vector vector(1536), -- For semantic search
    voice_transcript TEXT,
    voice_audio_url TEXT,
    privacy_level VARCHAR(20) DEFAULT 'family' CHECK (privacy_level IN ('private', 'family')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_journal_family_patient (family_id, patient_id),
    INDEX idx_journal_created_at (created_at DESC),
    INDEX idx_journal_content_vector (content_vector) USING ivfflat
);

-- Medication Management
CREATE TABLE medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255),
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    route VARCHAR(50), -- oral, injection, etc
    prescriber VARCHAR(255),
    pharmacy VARCHAR(255),
    start_date DATE NOT NULL,
    end_date DATE,
    refills_remaining INTEGER,
    photo_url TEXT,
    instructions TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_medications_patient_id (patient_id),
    INDEX idx_medications_active (patient_id, end_date)
);

CREATE TABLE medication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medication_id UUID REFERENCES medications(id) ON DELETE CASCADE,
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    given_time TIMESTAMP WITH TIME ZONE,
    given_by_user_id UUID REFERENCES users(id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('given', 'missed', 'refused', 'scheduled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_medication_logs_medication_id (medication_id),
    INDEX idx_medication_logs_scheduled_time (scheduled_time),
    INDEX idx_medication_logs_status (status),
    UNIQUE (medication_id, scheduled_time)
);

-- Care Tasks
CREATE TABLE care_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES families(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    recurrence_rule TEXT, -- RRULE format
    assigned_to_user_id UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_care_tasks_family_id (family_id),
    INDEX idx_care_tasks_assigned_to (assigned_to_user_id)
);

CREATE TABLE care_task_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES care_tasks(id) ON DELETE CASCADE,
    completed_by_user_id UUID REFERENCES users(id),
    scheduled_date DATE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    INDEX idx_care_task_logs_task_date (task_id, scheduled_date),
    UNIQUE (task_id, scheduled_date)
);

-- Document Storage
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES families(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('medical_record', 'financial', 'legal', 'insurance', 'other')),
    title VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    s3_key TEXT NOT NULL,
    mime_type VARCHAR(100),
    size_bytes BIGINT,
    uploaded_by_user_id UUID REFERENCES users(id),
    parsed_content JSONB,
    parsing_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_documents_family_patient (family_id, patient_id),
    INDEX idx_documents_type (type),
    INDEX idx_documents_parsed_content (parsed_content) USING gin
);

-- Location Tracking
CREATE TABLE item_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES families(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    location_description TEXT NOT NULL,
    photo_url TEXT,
    category VARCHAR(50),
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_item_locations_family_id (family_id),
    INDEX idx_item_locations_name (item_name)
);

-- Pattern Detection & Insights
CREATE TABLE insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES families(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- medication_adherence, behavior_pattern, health_correlation
    severity VARCHAR(20) CHECK (severity IN ('info', 'warning', 'alert')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    data JSONB,
    acknowledged_by_user_id UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_insights_family_patient (family_id, patient_id),
    INDEX idx_insights_severity_ack (severity, acknowledged_at)
);

-- Audit Trail
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID,
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_logs_family_id (family_id),
    INDEX idx_audit_logs_user_id (user_id),
    INDEX idx_audit_logs_created_at (created_at DESC)
);
```

### 2.2 Data Access Patterns

**Primary Access Patterns:**
1. Get all active medications for a patient
2. Get today's care tasks for a family
3. Get recent journal entries with privacy filtering
4. Search documents by content
5. Get medication adherence over time period
6. Get family activity summary

**Caching Strategy:**
- Redis cache for session data
- PostgreSQL materialized views for summaries
- S3 presigned URLs cached for 1 hour
- LLM responses cached by input hash

## 3. API Design

### 3.1 RESTful Endpoints

```typescript
// Authentication endpoints
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
GET    /api/v1/auth/me

// Family management
POST   /api/v1/families
GET    /api/v1/families/:id
PUT    /api/v1/families/:id
POST   /api/v1/families/:id/invite

// User management
GET    /api/v1/users
GET    /api/v1/users/:id
PUT    /api/v1/users/:id
DELETE /api/v1/users/:id

// Patient management
POST   /api/v1/patients
GET    /api/v1/patients
GET    /api/v1/patients/:id
PUT    /api/v1/patients/:id

// Journal entries
POST   /api/v1/journal-entries
GET    /api/v1/journal-entries?patient_id=&start_date=&end_date=
GET    /api/v1/journal-entries/:id
PUT    /api/v1/journal-entries/:id
DELETE /api/v1/journal-entries/:id

// Medications
POST   /api/v1/medications
GET    /api/v1/medications?patient_id=&active=true
GET    /api/v1/medications/:id
PUT    /api/v1/medications/:id
DELETE /api/v1/medications/:id

// Medication logs
POST   /api/v1/medication-logs
GET    /api/v1/medication-logs?medication_id=&date=
PUT    /api/v1/medication-logs/:id

// Care tasks
POST   /api/v1/care-tasks
GET    /api/v1/care-tasks?assigned_to=&date=
GET    /api/v1/care-tasks/:id
PUT    /api/v1/care-tasks/:id
DELETE /api/v1/care-tasks/:id

// Documents
POST   /api/v1/documents/upload
GET    /api/v1/documents?patient_id=&type=
GET    /api/v1/documents/:id
GET    /api/v1/documents/:id/download
DELETE /api/v1/documents/:id

// AI endpoints
POST   /api/v1/ai/summarize
POST   /api/v1/ai/query
POST   /api/v1/ai/extract-medication
POST   /api/v1/ai/detect-patterns

// Integration endpoints
GET    /api/v1/integrations/calendar/auth
POST   /api/v1/integrations/calendar/sync
POST   /api/v1/integrations/banking/link
GET    /api/v1/integrations/banking/transactions
```

### 3.2 Request/Response Examples

```typescript
// POST /api/v1/journal-entries
// Request
{
  "patient_id": "uuid",
  "content": "Mom seemed confused this morning...",
  "voice_transcript": "original voice text",
  "privacy_level": "family",
  "tags": ["confusion", "morning"]
}

// Response
{
  "id": "uuid",
  "patient_id": "uuid",
  "author": {
    "id": "uuid",
    "name": "Sarah Johnson"
  },
  "content": "Mom seemed confused this morning...",
  "privacy_level": "family",
  "tags": ["confusion", "morning"],
  "created_at": "2025-01-26T10:30:00Z",
  "ai_insights": {
    "sentiment": "concerned",
    "key_topics": ["confusion", "temporal_disorientation"],
    "suggested_actions": ["Track pattern", "Discuss with doctor"]
  }
}

// POST /api/v1/ai/summarize
// Request
{
  "patient_id": "uuid",
  "period": "week",
  "include_sections": ["health", "medications", "behaviors", "family_notes"]
}

// Response
{
  "summary": {
    "period": {
      "start": "2025-01-19",
      "end": "2025-01-26"
    },
    "health_trends": {
      "confusion_episodes": 3,
      "trend": "decreasing",
      "best_days": ["2025-01-21", "2025-01-24"],
      "concerns": ["morning_confusion", "medication_timing"]
    },
    "medication_adherence": {
      "overall_rate": 0.95,
      "missed_doses": [
        {
          "medication": "Aricept",
          "date": "2025-01-22",
          "time": "evening"
        }
      ]
    },
    "family_observations": {
      "total_visits": 12,
      "primary_caregiver_hours": 15,
      "key_observations": [
        "Improved mood mid-week",
        "Asking about deceased spouse",
        "Appetite concerns"
      ]
    },
    "recommended_actions": [
      {
        "priority": "high",
        "action": "Discuss morning confusion with neurologist",
        "reason": "Pattern of AM disorientation"
      }
    ]
  }
}
```

### 3.3 Error Handling

```typescript
// Standard error response format
{
  "error": {
    "code": "MEDICATION_NOT_FOUND",
    "message": "Medication with ID xxx not found",
    "details": {
      "medication_id": "xxx"
    },
    "request_id": "req_abc123"
  }
}

// Error codes
enum ErrorCodes {
  // Authentication
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // Resources
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  
  // Business logic
  MEDICATION_SCHEDULE_CONFLICT = 'MEDICATION_SCHEDULE_CONFLICT',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  FAMILY_LIMIT_REACHED = 'FAMILY_LIMIT_REACHED',
  
  // External services
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  INTEGRATION_ERROR = 'INTEGRATION_ERROR'
}
```

## 4. AI Integration Architecture

### 4.1 LLM Integration Layer

```typescript
// Prompt templates stored in database for easy updates
interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  version: number;
  model: 'gpt-4' | 'gpt-3.5-turbo';
  max_tokens: number;
  temperature: number;
}

// Example prompt for journal analysis
const JOURNAL_ANALYSIS_PROMPT = `
Analyze the following journal entry about an elderly patient with cognitive decline.
Extract key information while preserving the patient's dignity.

Journal Entry:
{content}

Provide analysis in the following JSON format:
{
  "sentiment": "positive|neutral|concerned|urgent",
  "key_topics": ["array of relevant medical/behavioral topics"],
  "cognitive_indicators": ["any signs of confusion, memory issues, etc"],
  "physical_health": ["mentioned symptoms or concerns"],
  "action_items": ["suggested follow-ups"],
  "privacy_concerns": ["any content that should remain private"]
}
`;

// Caching strategy for LLM calls
const getLLMResponse = async (prompt: string, cacheKey: string) => {
  // Check Redis cache first
  const cached = await redis.get(`llm:${cacheKey}`);
  if (cached) return JSON.parse(cached);
  
  // Make LLM call
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' }
  });
  
  // Cache for 1 hour
  await redis.setex(`llm:${cacheKey}`, 3600, JSON.stringify(response));
  return response;
};
```

### 4.2 Document Processing Pipeline

```typescript
// Document processing workflow
class DocumentProcessor {
  async processDocument(documentId: string) {
    // 1. Retrieve document from S3
    const document = await s3.getObject({ 
      Bucket: 'carecompanion-documents',
      Key: `${familyId}/${documentId}`
    });
    
    // 2. Extract text based on type
    let extractedText: string;
    if (isPDF(document)) {
      extractedText = await this.extractPDF(document);
    } else if (isImage(document)) {
      extractedText = await this.extractWithOCR(document);
    }
    
    // 3. Parse medical information
    const medicalData = await this.parseMedicalContent(extractedText);
    
    // 4. Store parsed results
    await db.documents.update({
      where: { id: documentId },
      data: {
        parsed_content: medicalData,
        parsing_status: 'completed'
      }
    });
    
    // 5. Trigger insight generation
    await jobQueue.add('generateInsights', { 
      documentId,
      familyId 
    });
  }
  
  private async parseMedicalContent(text: string) {
    const prompt = `Extract medical information from the following document...`;
    
    return await getLLMResponse(prompt, crypto.createHash('md5')
      .update(text.substring(0, 1000))
      .digest('hex')
    );
  }
}
```

### 4.3 Pattern Detection Service

```typescript
interface PatternDetectionConfig {
  medication_adherence: {
    threshold: 0.8,
    window_days: 7,
    alert_on_decline: true
  },
  behavior_patterns: {
    confusion_frequency_threshold: 3,
    sleep_correlation_window: 14
  },
  financial_anomalies: {
    unusual_amount_multiplier: 2.5,
    new_merchant_alert: true
  }
}

class PatternDetectionService {
  async detectPatterns(familyId: string, patientId: string) {
    const patterns = await Promise.all([
      this.analyzeMedicationAdherence(patientId),
      this.analyzeBehaviorPatterns(patientId),
      this.analyzeFinancialPatterns(familyId),
      this.correlateHealthFactors(patientId)
    ]);
    
    // Store significant patterns as insights
    for (const pattern of patterns.flat()) {
      if (pattern.significance > 0.7) {
        await this.createInsight(pattern);
      }
    }
  }
  
  private async analyzeBehaviorPatterns(patientId: string) {
    // Get recent journal entries
    const entries = await db.journalEntries.findMany({
      where: { 
        patient_id: patientId,
        created_at: { gte: daysAgo(30) }
      }
    });
    
    // Use LLM to identify patterns
    const prompt = this.buildBehaviorAnalysisPrompt(entries);
    const analysis = await getLLMResponse(prompt, `behavior:${patientId}:${Date.now()}`);
    
    return this.formatBehaviorInsights(analysis);
  }
}
```

## 5. Security Implementation

### 5.1 Authentication & Authorization

```typescript
// Middleware for authentication
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = await verifyToken(token);
    req.user = await getUserById(decoded.userId);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Role-based access control
export const authorize = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Resource-level authorization
export const authorizeResourceAccess = async (
  userId: string,
  resourceType: string,
  resourceId: string,
  requiredPermission: string
): Promise<boolean> => {
  // Check if user has access to the resource's family
  const resource = await getResource(resourceType, resourceId);
  const userFamily = await getUserFamily(userId);
  
  if (resource.familyId !== userFamily.id) {
    return false;
  }
  
  // Check specific permissions based on role
  return checkPermission(userFamily.role, requiredPermission);
};
```

### 5.2 Data Encryption

```typescript
// Encryption service
class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private keyDerivation = 'pbkdf2';
  
  async encryptSensitiveData(data: string, context: string): Promise<EncryptedData> {
    const key = await this.deriveKey(process.env.MASTER_KEY, context);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      version: 1
    };
  }
  
  async decryptSensitiveData(encryptedData: EncryptedData, context: string): Promise<string> {
    const key = await this.deriveKey(process.env.MASTER_KEY, context);
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      key,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

// Usage for sensitive journal entries
const encryptedContent = await encryptionService.encryptSensitiveData(
  journalEntry.content,
  `journal:${familyId}`
);
```

### 5.3 HIPAA Compliance Measures

```typescript
// Audit logging for HIPAA compliance
class AuditLogger {
  async logAccess(params: {
    userId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    patientId?: string;
    ip: string;
    userAgent: string;
  }) {
    await db.auditLogs.create({
      data: {
        user_id: params.userId,
        action: params.action,
        resource_type: params.resourceType,
        resource_id: params.resourceId,
        patient_id: params.patientId,
        ip_address: params.ip,
        user_agent: params.userAgent,
        created_at: new Date()
      }
    });
  }
  
  async logDataExport(userId: string, query: any, resultCount: number) {
    await db.auditLogs.create({
      data: {
        user_id: userId,
        action: 'DATA_EXPORT',
        details: {
          query,
          result_count: resultCount,
          exported_at: new Date()
        }
      }
    });
  }
}

// Automatic PHI detection
class PHIDetector {
  private patterns = {
    ssn: /\b\d{3}-?\d{2}-?\d{4}\b/,
    medicare: /\b[0-9]{3}-?[0-9]{2}-?[0-9]{4}-?[A-Z]\b/,
    creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/
  };
  
  detectPHI(text: string): PHIDetectionResult {
    const detected = [];
    
    for (const [type, pattern] of Object.entries(this.patterns)) {
      if (pattern.test(text)) {
        detected.push({ type, found: true });
      }
    }
    
    return {
      containsPHI: detected.length > 0,
      types: detected.map(d => d.type)
    };
  }
}
```

## 6. Performance Optimization

### 6.1 Database Optimization

```sql
-- Indexes for common queries
CREATE INDEX idx_journal_entries_search 
ON journal_entries USING gin(to_tsvector('english', content));

CREATE INDEX idx_medications_active_by_patient 
ON medications(patient_id, end_date) 
WHERE end_date IS NULL OR end_date > CURRENT_DATE;

-- Materialized view for medication adherence
CREATE MATERIALIZED VIEW medication_adherence_summary AS
SELECT 
  m.patient_id,
  m.id as medication_id,
  DATE_TRUNC('week', ml.scheduled_time) as week,
  COUNT(*) FILTER (WHERE ml.status = 'given') as doses_given,
  COUNT(*) as doses_scheduled,
  ROUND(COUNT(*) FILTER (WHERE ml.status = 'given')::numeric / COUNT(*)::numeric, 2) as adherence_rate
FROM medications m
JOIN medication_logs ml ON m.id = ml.medication_id
WHERE ml.scheduled_time >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY m.patient_id, m.id, week;

-- Refresh strategy
CREATE OR REPLACE FUNCTION refresh_adherence_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY medication_adherence_summary;
END;
$$ LANGUAGE plpgsql;
```

### 6.2 Caching Strategy

```typescript
// Multi-level caching
class CacheService {
  private memoryCache = new Map();
  private redis: Redis;
  
  async get<T>(key: string): Promise<T | null> {
    // L1: Memory cache (instant)
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }
    
    // L2: Redis cache (fast)
    const redisValue = await this.redis.get(key);
    if (redisValue) {
      const parsed = JSON.parse(redisValue);
      this.memoryCache.set(key, parsed);
      return parsed;
    }
    
    return null;
  }
  
  async set<T>(key: string, value: T, ttlSeconds: number) {
    // Set in both caches
    this.memoryCache.set(key, value);
    await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    
    // Expire from memory cache
    setTimeout(() => {
      this.memoryCache.delete(key);
    }, ttlSeconds * 1000);
  }
}

// Cache warming for frequently accessed data
class CacheWarmer {
  async warmFamilyCache(familyId: string) {
    const [patients, activeMeds, recentTasks] = await Promise.all([
      db.patients.findMany({ where: { family_id: familyId }}),
      db.medications.findMany({ 
        where: { 
          patient: { family_id: familyId },
          OR: [
            { end_date: null },
            { end_date: { gt: new Date() }}
          ]
        }
      }),
      db.careTasks.findMany({
        where: { 
          family_id: familyId,
          created_at: { gt: daysAgo(7) }
        }
      })
    ]);
    
    await cache.set(`family:${familyId}:patients`, patients, 3600);
    await cache.set(`family:${familyId}:medications`, activeMeds, 1800);
    await cache.set(`family:${familyId}:tasks`, recentTasks, 900);
  }
}
```

### 6.3 Query Optimization

```typescript
// Efficient data loading with DataLoader pattern
class MedicationLoader extends DataLoader<string, Medication> {
  constructor() {
    super(async (medicationIds: string[]) => {
      const medications = await db.medications.findMany({
        where: { id: { in: medicationIds } }
      });
      
      // Map results back to original order
      const medicationMap = new Map(
        medications.map(med => [med.id, med])
      );
      
      return medicationIds.map(id => medicationMap.get(id));
    });
  }
}

// Pagination with cursor
async function getPaginatedJournalEntries(
  patientId: string,
  cursor?: string,
  limit: number = 20
) {
  const entries = await db.journalEntries.findMany({
    where: { patient_id: patientId },
    orderBy: { created_at: 'desc' },
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined
  });
  
  const hasNextPage = entries.length > limit;
  const items = hasNextPage ? entries.slice(0, -1) : entries;
  
  return {
    items,
    nextCursor: hasNextPage ? items[items.length - 1].id : null
  };
}
```

## 7. Background Jobs Architecture

### 7.1 Job Queue Design

```typescript
// Job definitions
interface JobTypes {
  'processDocument': { documentId: string; familyId: string };
  'generateSummary': { familyId: string; period: 'daily' | 'weekly' };
  'checkMedicationAdherence': { patientId: string };
  'detectPatterns': { familyId: string; patientId: string };
  'sendReminder': { userId: string; type: string; data: any };
  'syncCalendar': { userId: string; calendarId: string };
}

// Job processor setup
class JobProcessor {
  constructor(private queue: Queue) {
    this.registerProcessors();
  }
  
  private registerProcessors() {
    this.queue.process('processDocument', async (job) => {
      const { documentId, familyId } = job.data;
      await documentProcessor.processDocument(documentId);
    });
    
    this.queue.process('generateSummary', async (job) => {
      const { familyId, period } = job.data;
      const summary = await summaryService.generate(familyId, period);
      await notificationService.sendSummary(familyId, summary);
    });
    
    this.queue.process('checkMedicationAdherence', async (job) => {
      const { patientId } = job.data;
      const adherence = await medicationService.checkAdherence(patientId);
      
      if (adherence.rate < 0.8) {
        await insightService.create({
          type: 'medication_adherence',
          severity: 'warning',
          title: 'Low medication adherence detected',
          description: `Adherence rate: ${adherence.rate * 100}%`
        });
      }
    });
  }
}

// Scheduled jobs
class ScheduledJobs {
  async initialize() {
    // Daily summary generation
    cron.schedule('0 8 * * *', async () => {
      const families = await db.families.findMany();
      
      for (const family of families) {
        await jobQueue.add('generateSummary', {
          familyId: family.id,
          period: 'daily'
        });
      }
    });
    
    // Medication reminders
    cron.schedule('*/30 * * * *', async () => {
      const upcomingDoses = await db.medicationLogs.findMany({
        where: {
          scheduled_time: {
            gte: new Date(),
            lte: addMinutes(new Date(), 30)
          },
          status: 'scheduled'
        },
        include: { medication: { include: { patient: true } } }
      });
      
      for (const dose of upcomingDoses) {
        await jobQueue.add('sendReminder', {
          userId: dose.medication.patient.primary_caregiver_id,
          type: 'medication',
          data: dose
        });
      }
    });
  }
}
```

## 8. Monitoring & Observability

### 8.1 Logging Strategy

```typescript
// Structured logging
import winston from 'winston';

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'carecompanion-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({ 
      filename: 'error.log', 
      level: 'error' 
    })
  ]
});

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      user_id: req.user?.id,
      family_id: req.user?.family_id,
      ip: req.ip
    });
  });
  
  next();
};
```

### 8.2 Metrics & Alerts

```typescript
// Key metrics to track
interface MetricsConfig {
  // Business metrics
  dailyActiveUsers: Counter;
  journalEntriesCreated: Counter;
  medicationAdherenceRate: Gauge;
  documentsProcessed: Counter;
  
  // Technical metrics
  apiResponseTime: Histogram;
  databaseQueryTime: Histogram;
  jobProcessingTime: Histogram;
  errorRate: Counter;
  
  // AI metrics
  llmTokensUsed: Counter;
  llmResponseTime: Histogram;
  ocrAccuracy: Gauge;
}

// Alert configurations
const alerts = [
  {
    name: 'HighErrorRate',
    condition: 'rate(errors[5m]) > 0.05',
    severity: 'critical',
    notification: 'pagerduty'
  },
  {
    name: 'LowMedicationAdherence',
    condition: 'medication_adherence_rate < 0.7',
    severity: 'warning',
    notification: 'email'
  },
  {
    name: 'SlowAPIResponse',
    condition: 'api_response_time_p95 > 2000',
    severity: 'warning',
    notification: 'slack'
  }
];
```

## 9. Deployment Architecture

### 9.1 Infrastructure as Code

```yaml
# docker-compose.yml for local development
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: carecompanion
      POSTGRES_USER: cc_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build: .
    environment:
      DATABASE_URL: postgresql://cc_user:${DB_PASSWORD}@postgres:5432/carecompanion
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    depends_on:
      - postgres
      - redis
    ports:
      - "3000:3000"

  worker:
    build: .
    command: npm run worker
    environment:
      DATABASE_URL: postgresql://cc_user:${DB_PASSWORD}@postgres:5432/carecompanion
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis

volumes:
  postgres_data:
```

### 9.2 Production Deployment

```typescript
// Health check endpoint
app.get('/health', async (req, res) => {
  const checks = {
    api: 'healthy',
    database: 'unknown',
    redis: 'unknown',
    storage: 'unknown'
  };
  
  try {
    // Check database
    await db.$queryRaw`SELECT 1`;
    checks.database = 'healthy';
    
    // Check Redis
    await redis.ping();
    checks.redis = 'healthy';
    
    // Check S3
    await s3.headBucket({ Bucket: 'carecompanion-documents' });
    checks.storage = 'healthy';
    
    const allHealthy = Object.values(checks).every(status => status === 'healthy');
    
    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      checks,
      error: error.message
    });
  }
});
```

## 10. Testing Strategy

### 10.1 Test Structure

```typescript
// Unit test example
describe('MedicationService', () => {
  describe('checkAdherence', () => {
    it('should calculate adherence correctly', async () => {
      const patientId = 'test-patient-id';
      
      // Mock data
      const mockLogs = [
        { status: 'given', scheduled_time: new Date() },
        { status: 'given', scheduled_time: new Date() },
        { status: 'missed', scheduled_time: new Date() },
        { status: 'given', scheduled_time: new Date() }
      ];
      
      jest.spyOn(db.medicationLogs, 'findMany').mockResolvedValue(mockLogs);
      
      const result = await medicationService.checkAdherence(patientId);
      
      expect(result.rate).toBe(0.75);
      expect(result.missedDoses).toBe(1);
    });
  });
});

// Integration test example
describe('Journal Entry API', () => {
  it('should create entry with privacy filtering', async () => {
    const response = await request(app)
      .post('/api/v1/journal-entries')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        patient_id: testPatientId,
        content: 'Mom had a good day today',
        privacy_level: 'private'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.privacy_level).toBe('private');
    
    // Verify other family members can't see it
    const otherUserResponse = await request(app)
      .get(`/api/v1/journal-entries/${response.body.id}`)
      .set('Authorization', `Bearer ${otherUserToken}`);
    
    expect(otherUserResponse.status).toBe(403);
  });
});
```

### 10.2 Test Data Management

```typescript
// Test data factory
class TestDataFactory {
  async createFamily(overrides = {}) {
    return await db.families.create({
      data: {
        name: faker.company.name(),
        subscription_tier: 'free',
        ...overrides
      }
    });
  }
  
  async createPatientWithMedications(familyId: string, medicationCount = 3) {
    const patient = await db.patients.create({
      data: {
        family_id: familyId,
        name: faker.person.fullName(),
        date_of_birth: faker.date.birthdate({ min: 65, max: 95 })
      }
    });
    
    const medications = await Promise.all(
      Array.from({ length: medicationCount }, () =>
        db.medications.create({
          data: {
            patient_id: patient.id,
            name: faker.helpers.arrayElement(['Aricept', 'Metformin', 'Lisinopril']),
            dosage: '10mg',
            frequency: 'twice daily',
            start_date: faker.date.recent({ days: 30 })
          }
        })
      )
    );
    
    return { patient, medications };
  }
}
```

---

