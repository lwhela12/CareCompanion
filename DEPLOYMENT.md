# CareCompanion Deployment Guide

This guide covers deploying CareCompanion with a split architecture:
- **Frontend (apps/web)** → Vercel
- **Backend (apps/api)** → Railway
- **Database** → Railway Postgres
- **Redis** → Railway Redis

## Prerequisites

1. Accounts on:
   - [Vercel](https://vercel.com)
   - [Railway](https://railway.app)
   - [Clerk](https://clerk.com) - for authentication
   - [OpenAI](https://platform.openai.com) - for AI features
   - [AWS](https://aws.amazon.com) - for S3 storage

2. Install CLI tools (optional):
   ```bash
   npm install -g vercel railway
   ```

## Part 1: Railway Backend Setup

### Step 1: Create Railway Project

1. Go to [Railway](https://railway.app) and create a new project
2. Add three services:
   - **PostgreSQL** (from templates)
   - **Redis** (from templates)
   - **API** (from GitHub repo)

### Step 2: Configure PostgreSQL

Railway will auto-generate the database. Note the connection string format:
```
postgresql://postgres:password@host:port/railway
```

### Step 3: Configure API Service

1. Connect your GitHub repository
2. Set **Root Directory**: Leave empty (monorepo will be detected)
3. Set **Build Command**:
   ```bash
   npm install && npm run db:generate && npm run build --filter=@carecompanion/api
   ```
4. Set **Start Command**:
   ```bash
   cd apps/api && npm start
   ```
5. Set **Watch Paths**: `apps/api/**`

### Step 4: Set Environment Variables on Railway

Go to your API service → Variables and add:

```bash
# Node Environment
NODE_ENV=production
PORT=3000

# Database (use Railway's DATABASE_URL reference)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Redis (use Railway's REDIS_URL reference)
REDIS_URL=${{Redis.REDIS_URL}}

# Clerk Authentication
CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx

# OpenAI
OPENAI_API_KEY=sk-xxx

# AWS S3
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1
S3_BUCKET_NAME=carecompanion-documents

# Frontend URL (will be your Vercel URL)
FRONTEND_URL=https://your-app.vercel.app

# Logging
LOG_LEVEL=info
```

### Step 5: Run Database Migrations on Railway

After deployment, run migrations:

1. Open Railway dashboard → API service → Terminal
2. Run:
   ```bash
   cd packages/database && npx prisma migrate deploy
   ```

Or use Railway CLI:
```bash
railway run npm run db:migrate
```

### Step 6: Note Your Railway URLs

Your API will be available at:
```
https://your-app.up.railway.app
```

Test the health endpoint:
```bash
curl https://your-app.up.railway.app/health
```

## Part 2: Vercel Frontend Setup

### Step 1: Update vercel.json

The `vercel.json` in the root directory needs your Railway URL. Update it:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-app.up.railway.app/api/:path*"
    }
  ]
}
```

### Step 2: Deploy to Vercel

#### Option A: Vercel Dashboard

1. Go to [Vercel](https://vercel.com/new)
2. Import your GitHub repository
3. Configure project:
   - **Framework Preset**: Vite
   - **Root Directory**: `apps/web`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `cd ../.. && npm install`

#### Option B: Vercel CLI

```bash
cd /path/to/CareCompanion
vercel
```

Follow the prompts to link your project.

### Step 3: Set Environment Variables on Vercel

Go to Project Settings → Environment Variables and add:

```bash
# API URL (your Railway backend)
VITE_API_URL=https://your-app.up.railway.app

# Clerk (same publishable key as backend)
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxx
```

### Step 4: Redeploy

After setting environment variables:
```bash
vercel --prod
```

Or trigger a redeploy from the Vercel dashboard.

## Part 3: Additional Setup

### AWS S3 Bucket Setup

1. Create S3 bucket named `carecompanion-documents`
2. Configure CORS:
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
       "AllowedOrigins": [
         "https://your-app.vercel.app",
         "https://your-app.up.railway.app"
       ],
       "ExposeHeaders": ["ETag"]
     }
   ]
   ```
3. Create IAM user with S3 permissions
4. Add credentials to Railway environment variables

### Clerk Setup

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Create application or use existing
3. Configure allowed origins:
   - Add your Vercel URL: `https://your-app.vercel.app`
   - Add your Railway API URL: `https://your-app.up.railway.app`
4. Copy keys to both Railway and Vercel

## Part 4: Verify Deployment

### Test Checklist

- [ ] Frontend loads at Vercel URL
- [ ] Health check works: `https://railway-url/health`
- [ ] Clerk authentication works (sign up/sign in)
- [ ] API calls from frontend reach backend
- [ ] Database queries work
- [ ] File uploads to S3 work
- [ ] Background jobs are running (check Railway logs)

### Check Railway Logs

```bash
railway logs --service api
```

Look for:
- ✅ "Server running on port 3000"
- ✅ Database connection successful
- ✅ Redis connection successful
- ✅ Background jobs initialized

### Check Vercel Deployment Logs

Go to Vercel Dashboard → Your Project → Deployments → Latest → View Build Logs

## Environment Variables Reference

### Railway (Backend) - Required

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | Redis connection | `${{Redis.REDIS_URL}}` |
| `CLERK_PUBLISHABLE_KEY` | Clerk auth | `pk_live_xxx` |
| `CLERK_SECRET_KEY` | Clerk auth | `sk_live_xxx` |
| `OPENAI_API_KEY` | OpenAI API | `sk-xxx` |
| `AWS_ACCESS_KEY_ID` | AWS credentials | Your AWS key |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials | Your AWS secret |
| `AWS_REGION` | AWS region | `us-east-1` |
| `S3_BUCKET_NAME` | S3 bucket | `carecompanion-documents` |
| `FRONTEND_URL` | Vercel URL | `https://your-app.vercel.app` |

### Vercel (Frontend) - Required

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Railway backend URL | `https://your-app.up.railway.app` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk auth | `pk_live_xxx` |

## Troubleshooting

### Frontend can't reach backend

1. Check CORS settings in Railway backend
2. Verify `FRONTEND_URL` in Railway matches Vercel URL
3. Check `VITE_API_URL` in Vercel settings

### Database connection fails

1. Check `DATABASE_URL` format
2. Verify Railway Postgres is running
3. Check if migrations ran: `railway run npm run db:migrate`

### Redis connection fails

1. Verify `REDIS_URL` in Railway
2. Check Redis service is running in Railway

### Background jobs not running

1. Check Railway logs: `railway logs`
2. Verify Redis connection
3. Check if Bull queues initialized

### Clerk authentication fails

1. Verify both keys are set correctly
2. Check allowed origins in Clerk dashboard
3. Ensure frontend and backend use same Clerk app

## Continuous Deployment

### Automatic Deployments

Both platforms support auto-deploy from GitHub:

**Railway**: Auto-deploys on push to main branch
**Vercel**: Auto-deploys on push to main branch

### Branch Previews

**Vercel**: Automatically creates preview deployments for PRs
**Railway**: Can configure PR deployments in settings

## Cost Estimates

### Railway (Free tier)
- $5 credit per month
- Includes: API + Postgres + Redis
- Typically sufficient for development/small projects

### Vercel (Hobby tier)
- Free for personal projects
- 100GB bandwidth
- Unlimited deployments

### Production recommendations:
- Railway Pro: ~$20-50/month (depending on usage)
- Vercel Pro: $20/month
- AWS S3: ~$5-20/month (depending on storage)

## Monitoring

### Railway
- Built-in metrics dashboard
- Log aggregation
- Resource usage monitoring

### Vercel
- Analytics dashboard
- Build logs
- Performance insights

### External Monitoring (Recommended)
- [Sentry](https://sentry.io) - Error tracking
- [LogRocket](https://logrocket.com) - Session replay
- [Datadog](https://datadog.com) - APM

## Rollback Procedure

### Railway
```bash
railway rollback
```

Or use the dashboard to deploy a previous version.

### Vercel
Go to Deployments → Select previous deployment → Promote to Production

## Next Steps

1. Set up monitoring and alerts
2. Configure custom domain names
3. Set up automated backups for Postgres
4. Enable SSL/TLS
5. Set up CI/CD pipelines
6. Configure staging environments
