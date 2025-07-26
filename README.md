# CareCompanion

AI-powered platform to help families manage care for aging parents with cognitive decline.

## Project Structure

This is a monorepo project using Turborepo with the following structure:

```
carecompanion/
├── apps/
│   ├── web/          # React frontend with TypeScript
│   └── api/          # Express.js backend API
├── packages/
│   ├── database/     # Prisma ORM and database schema
│   └── shared/       # Shared types and utilities
└── infrastructure/   # Deployment configurations
```

## Prerequisites

- Node.js 20+ and npm 10+
- Docker and Docker Compose
- PostgreSQL (via Docker)
- Redis (via Docker)

## Getting Started

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd carecompanion
npm install
```

### 2. Set Up Environment Variables

Copy the example environment files:

```bash
# Root level
cp .env.example .env

# Database package
cp packages/database/.env.example packages/database/.env

# API
cp apps/api/.env.example apps/api/.env

# Web
cp apps/web/.env.example apps/web/.env
```

### 3. Set Up Clerk Authentication

1. Sign up for a free account at [Clerk.com](https://clerk.com)
2. Create a new application
3. Copy your Publishable Key and Secret Key
4. Add them to the environment files:
   - `CLERK_PUBLISHABLE_KEY` in `apps/api/.env`
   - `CLERK_SECRET_KEY` in `apps/api/.env`
   - `VITE_CLERK_PUBLISHABLE_KEY` in `apps/web/.env`

### 4. Start Docker Services

```bash
docker compose up -d
```

This starts PostgreSQL on port 5432 and Redis on port 6379.

### 5. Set Up Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# (Optional) Open Prisma Studio to view database
npm run db:studio
```

### 6. Start Development Servers

```bash
npm run dev
```

This starts:
- API server on http://localhost:3000
- Web app on http://localhost:5173

## Available Scripts

### Root Level
- `npm run dev` - Start all apps in development mode
- `npm run build` - Build all apps
- `npm run lint` - Lint all packages
- `npm run test` - Run tests
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

### API (`apps/api`)
- `npm run dev` - Start API in development mode
- `npm run build` - Build API for production
- `npm run start` - Start production API

### Web (`apps/web`)
- `npm run dev` - Start React app in development mode
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Tech Stack

### Frontend
- React 18 with TypeScript
- Tailwind CSS for styling
- Clerk for authentication
- React Query for data fetching
- Zustand for state management
- React Router for navigation

### Backend
- Node.js with Express
- TypeScript
- Prisma ORM
- PostgreSQL database
- Redis for caching/queues
- OpenAI API for AI features

### Infrastructure
- Docker for local development
- Turborepo for monorepo management
- AWS S3 for file storage (production)

## Next Steps

The foundation is now set up. The next priorities are:

1. **Complete Clerk Authentication Setup** - Configure Clerk dashboard and test auth flow
2. **Implement Core Features**:
   - Patient management
   - Medication tracking
   - Journal entries with voice input
   - Family member invitations
3. **Add AI Integration** for summaries and insights
4. **Deploy to Production** (AWS/Vercel recommended)

## Development Guidelines

See `CLAUDE.md` for detailed development guidelines and best practices.

## License

Private - All rights reserved