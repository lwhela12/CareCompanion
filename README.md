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

Create a single `.env` file in the root directory:

```bash
cp .env.example .env
```

**Note**: The API and database packages use symlinks to the root `.env` file to ensure consistency.

### 3. Set Up Clerk Authentication

1. Sign up for a free account at [Clerk.com](https://clerk.com)
2. Create a new application
3. Copy your Publishable Key and Secret Key
4. Add them to the environment files:
   - `CLERK_PUBLISHABLE_KEY` in `apps/api/.env`
   - `CLERK_SECRET_KEY` in `apps/api/.env`
   - `VITE_CLERK_PUBLISHABLE_KEY` in `apps/web/.env`

### 4. Start Docker Services and Set Up Database

```bash
# Quick setup - starts Docker and checks database health
npm run setup:db

# Or manually:
docker compose up -d

# Then run migrations
npm run db:generate
npm run db:migrate
```

This starts PostgreSQL on port 5432 and Redis on port 6379.

**Database Health Check**: Run `npm run check:db` anytime to verify your database is properly configured.

### 5. Start Development Servers

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
- `npm run setup:db` - Set up Docker and database (run this first!)
- `npm run check:db` - Verify database health
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

## Troubleshooting

### Database Connection Issues

If you encounter database connection errors:

1. **Check Docker is running**: 
   ```bash
   docker ps
   ```
   If not, start Docker Desktop.

2. **Run the database setup script**:
   ```bash
   npm run setup:db
   ```
   This will check Docker, verify the database exists, and ensure tables are in the correct schema.

3. **Verify environment variables**:
   - Ensure `.env` file exists in the root directory
   - `DATABASE_URL` should be: `postgresql://postgres:postgres@localhost:5432/carecompanion`
   - No schema parameters should be in the URL

4. **Reset everything** (if needed):
   ```bash
   docker-compose down -v  # Remove volumes
   docker-compose up -d    # Start fresh
   npm run db:migrate      # Run migrations
   ```

### Common Issues

- **Port 3000 already in use**: Kill the process with `lsof -ti :3000 | xargs kill -9`
- **Docker not starting**: Restart Docker Desktop
- **Prisma client issues**: Run `npm run db:generate` to regenerate

## Development Guidelines

See `CLAUDE.md` for detailed development guidelines and best practices.

## License

Private - All rights reserved