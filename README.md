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

## Quick Start (One Command!)

### 🚀 The Fastest Way

```bash
npm install              # First time only
npm run start:full      # Starts EVERYTHING in one terminal!
```

This single command will:
- ✅ Check Docker is running
- ✅ Start PostgreSQL, Redis, and LocalStack
- ✅ Initialize S3 bucket
- ✅ Install dependencies
- ✅ Start API and Web servers

Then open: **http://localhost:5173** 🎉

### 💡 Alternative Commands

```bash
# If Docker is already running and you just want to start the apps:
npm start

# Traditional way (API and Web in separate terminals):
npm run dev
```

## Detailed Setup (If Needed)

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd carecompanion
npm install
```

### 2. Set Up Environment Variables

Your `.env` is already configured for local development with LocalStack (no AWS account needed!)

To use real AWS S3 later, update:
```env
AWS_ACCESS_KEY_ID=your-real-key
AWS_SECRET_ACCESS_KEY=your-real-secret
# Comment out:
# AWS_ENDPOINT_URL="http://localhost:4566"
```

### 3. Set Up Clerk Authentication

Your Clerk keys are already in `.env` for development. For production:

1. Sign up for a free account at [Clerk.com](https://clerk.com)
2. Create a new application
3. Copy your keys to `.env`

### 4. Manual Docker Setup (Optional)

If you don't use `npm run start:full`, you can manually start services:

```bash
docker-compose up -d
npm run db:migrate
./scripts/init-localstack.sh  # For S3
```

### 5. Start Development Servers

```bash
# Best option - one terminal:
npm run start:full

# Just apps (Docker already running):
npm start

# Traditional (separate terminals):
npm run dev
```

## Available Scripts

### 🚀 Development
- `npm run start:full` - **⭐ RECOMMENDED** - Starts everything (Docker + Apps) in one terminal
- `npm start` - Start API and Web (assumes Docker is running)
- `npm run dev` - Traditional turbo dev (starts all workspaces)
- `npm run dev:both` - Start API and Web with colored output
- `npm run dev:api` - Start only API server
- `npm run dev:web` - Start only Web server

### 🗄️ Database
- `npm run setup:db` - Set up Docker and database (run this first!)
- `npm run check:db` - Verify database health
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

### 🏗️ Build & Test
- `npm run build` - Build all apps
- `npm run lint` - Lint all packages
- `npm run test` - Run tests
- `npm run clean` - Clean all build artifacts

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

## Deployment

Ready to deploy? See the **[Deployment Guide](DEPLOYMENT.md)** for step-by-step instructions on deploying to:
- **Frontend**: Vercel
- **Backend**: Railway
- **Database**: Railway PostgreSQL
- **Redis**: Railway Redis

Quick checklist: [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)

## Next Steps

The foundation is now set up. The next priorities are:

1. **Complete Clerk Authentication Setup** - Configure Clerk dashboard and test auth flow
2. **Implement Core Features**:
   - Patient management
   - Medication tracking
   - Journal entries with voice input
   - Family member invitations
3. **Add AI Integration** for summaries and insights
4. **Deploy to Production** - See [DEPLOYMENT.md](DEPLOYMENT.md)

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