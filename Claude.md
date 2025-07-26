# Claude.md - CareCompanion Development Guide

## Overview

You are building CareCompanion, an AI-powered platform to help families manage care for aging parents with cognitive decline. This document provides guidance on how to approach development, make decisions, and maintain consistency throughout the project.

## Project Context

**Core Purpose**: Reduce cognitive burden on family caregivers by centralizing care information, tracking patterns, and providing AI-driven insights.

**Key Documents**:
- `Product_Requirements_Document.md` - Product Requirements Document (WHAT we're building)
- `Design_Document.md` - Technical Design Document (HOW we're building it)
- 'design/UI_Design.md' - UI Design Guide

## Development Philosophy

### 1. Caregiver-First Design
Every feature should either:
- Reduce caregiver cognitive load
- Prevent caregiver guilt/worry
- Save time in care coordination
- Improve care quality

If a feature doesn't clearly serve one of these goals, reconsider its priority.

### 2. Simplicity Over Complexity
- Caregivers are stressed and time-constrained
- Interfaces must be immediately intuitive
- Voice/photo input > typing when possible
- Smart defaults > configuration options

### 3. Privacy and Dignity
- Patient dignity is paramount
- Never expose raw emotional content
- Summarize concerns clinically
- Protect vulnerable moments

## Code Style Guidelines

### TypeScript Standards
```typescript
// ✅ Good: Clear types, descriptive names
interface MedicationLog {
  medicationId: string;
  scheduledTime: Date;
  givenTime?: Date;
  status: 'given' | 'missed' | 'refused';
}

// ❌ Bad: Any types, unclear names
interface MedLog {
  med: any;
  time: any;
  stat: string;
}
```

### API Design
```typescript
// ✅ Good: RESTful, clear intent
GET    /api/v1/patients/:id/medications?active=true
POST   /api/v1/medication-logs
PUT    /api/v1/medication-logs/:id

// ❌ Bad: Unclear endpoints
GET    /api/getMeds
POST   /api/updateMedStatus
```

### Error Handling
```typescript
// ✅ Good: Specific error types, helpful messages
throw new ValidationError('Medication schedule conflicts with existing dose at 8:00 AM');

// ❌ Bad: Generic errors
throw new Error('Invalid input');
```

## Project Structure

```
carecompanion/
├── apps/
│   ├── web/                 # React frontend
│   │   ├── src/
│   │   │   ├── components/  # Reusable UI components
│   │   │   ├── features/    # Feature-specific modules
│   │   │   ├── hooks/       # Custom React hooks
│   │   │   ├── lib/         # Utilities and helpers
│   │   │   └── pages/       # Route components
│   └── api/                 # Node.js backend
│       ├── src/
│       │   ├── controllers/ # Route handlers
│       │   ├── services/    # Business logic
│       │   ├── models/      # Database models
│       │   ├── middleware/  # Express middleware
│       │   └── jobs/        # Background job processors
├── packages/
│   ├── shared/              # Shared types and utilities
│   └── database/            # Prisma schema and migrations
└── infrastructure/          # Deployment configs
```

## Development Workflow

### 1. Feature Implementation Flow
```bash
# 1. Start with the database schema
# Edit packages/database/schema.prisma

# 2. Generate types and migration
npm run db:generate
npm run db:migrate

# 3. Implement API endpoint
# Create controller in apps/api/src/controllers/
# Create service in apps/api/src/services/

# 4. Add frontend component
# Create feature in apps/web/src/features/

# 5. Test the full flow
npm run test
```

### 2. Common Development Tasks

#### Adding a New API Endpoint
1. Define the route in `apps/api/src/routes/`
2. Create controller method with proper validation
3. Implement business logic in service layer
4. Add integration tests
5. Update API documentation

#### Adding a New Database Model
1. Update `packages/database/schema.prisma`
2. Run `npm run db:generate`
3. Create migration: `npm run db:migrate:dev`
4. Create corresponding TypeScript interfaces
5. Add seed data if needed

#### Implementing AI Features
1. Create prompt template in `apps/api/src/prompts/`
2. Implement service method with caching
3. Handle errors gracefully (AI services can fail)
4. Add fallback behavior
5. Monitor token usage

## Key Technical Decisions

### State Management
- **Frontend**: Zustand for global state, React Query for server state
- **Why**: Simpler than Redux, better caching than Context alone

### Database Queries
- **Use Prisma** for type-safe queries
- **Raw SQL** only for complex aggregations
- **Always** include proper indexes

### File Uploads
- **Direct to S3** from frontend using presigned URLs
- **Process asynchronously** via job queue
- **Store metadata** in PostgreSQL

### Authentication
- **Use Clerk/Auth0** rather than building custom auth
- **Session-based** for web, JWT for future mobile
- **Role-based** permissions at family level

## Common Patterns

### 1. Privacy-Preserving Summaries
```typescript
// Transform sensitive content
function summarizeJournalEntry(entry: JournalEntry): Summary {
  // Never include direct quotes about:
  // - Bathroom incidents
  // - Family conflicts  
  // - Financial fears
  // - Death wishes
  
  return {
    sentiment: analyzeSentiment(entry.content),
    concerns: extractConcerns(entry.content),
    // Generic language only
    summary: "Patient expressed frustration with daily activities"
  };
}
```

### 2. Medication Tracking
```typescript
// Always track who, what, when
interface MedicationLog {
  medicationId: string;
  scheduledTime: Date;
  givenTime?: Date;
  givenByUserId?: string;
  status: MedicationStatus;
  notes?: string; // For "refused" status
}

// Smart reminders
function shouldSendReminder(log: MedicationLog): boolean {
  const now = new Date();
  const scheduled = new Date(log.scheduledTime);
  const minutesUntil = (scheduled.getTime() - now.getTime()) / 60000;
  
  return (
    log.status === 'scheduled' &&
    minutesUntil > 0 &&
    minutesUntil <= 30
  );
}
```

### 3. AI Integration
```typescript
// Always handle AI failures gracefully
async function generateSummary(familyId: string): Promise<Summary> {
  try {
    const cached = await cache.get(`summary:${familyId}:${today}`);
    if (cached) return cached;
    
    const summary = await aiService.generateSummary(familyId);
    await cache.set(`summary:${familyId}:${today}`, summary, 3600);
    
    return summary;
  } catch (error) {
    logger.error('AI summary generation failed', { familyId, error });
    
    // Return basic summary from raw data
    return generateBasicSummary(familyId);
  }
}
```

## Testing Guidelines

### Unit Tests
- Test business logic in services
- Mock external dependencies
- Focus on edge cases

### Integration Tests
- Test API endpoints end-to-end
- Use test database
- Verify permissions

### E2E Tests (Future)
- Critical user journeys only
- Medicine tracking flow
- Journal entry with privacy

## Performance Considerations

### Database
- Index foreign keys and common WHERE clauses
- Use materialized views for complex aggregations
- Implement cursor-based pagination

### Caching
- Cache AI responses (1 hour)
- Cache user sessions (Redis)
- Cache document presigned URLs

### Frontend
- Lazy load routes
- Optimize images before upload
- Debounce search inputs

## Security Checklist

- [ ] All routes require authentication
- [ ] Role-based access control implemented
- [ ] Patient data encrypted at rest
- [ ] Audit logs for all data access
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (use Prisma)
- [ ] XSS prevention (React handles this)
- [ ] CSRF tokens for state-changing operations
- [ ] Rate limiting on all endpoints
- [ ] Secure session management

## Deployment Checklist

### Environment Variables
```env
# Required for all environments
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
OPENAI_API_KEY=

# Production only
SENTRY_DSN=
S3_BUCKET=
CLOUDFRONT_URL=

# Optional integrations
PLAID_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_ID=
```

### Pre-deployment
- [ ] Run migrations on staging
- [ ] Test with production-like data
- [ ] Verify error handling
- [ ] Check performance metrics
- [ ] Update documentation

## Common Pitfalls to Avoid

1. **Over-engineering**: Start simple, iterate based on user feedback
2. **Complex UIs**: If it needs explanation, it's too complex
3. **Forgetting offline**: Elderly homes may have poor internet
4. **Ignoring errors**: Always handle failures gracefully
5. **Raw data exposure**: Always filter sensitive content
6. **Assuming tech literacy**: Design for non-technical users

## Getting Help

When stuck, consider:
1. What would reduce caregiver stress?
2. How would a tired, stressed person use this?
3. What's the simplest solution that works?
4. How does this protect patient dignity?

## Quick Command Reference

```bash
# Development
npm run dev              # Start all services
npm run db:studio        # Open Prisma Studio
npm run db:migrate:dev   # Create migration
npm run test            # Run tests
npm run lint            # Check code style

# Production
npm run build           # Build all apps
npm run start           # Start production server
npm run db:migrate      # Run migrations
```

## Remember

You're building a tool for people in one of life's most challenging situations. Every feature should make their day a little easier, every interaction should respect their emotional state, and every piece of data should be treated with the privacy it deserves.

When in doubt, optimize for simplicity and compassion over technical elegance.