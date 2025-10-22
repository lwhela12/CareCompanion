# Deployment Checklist

Use this checklist to ensure you've completed all steps for deploying CareCompanion.

## Pre-Deployment

- [ ] Code is committed and pushed to GitHub
- [ ] All tests pass locally
- [ ] Environment variables are documented
- [ ] Database migrations are up to date

## Railway Setup (Backend)

### Create Services
- [ ] Railway account created
- [ ] New project created
- [ ] PostgreSQL database added
- [ ] Redis service added
- [ ] API service created from GitHub repo

### Configure API Service
- [ ] Build command set: `npm install && npm run db:generate && npm run build --filter=@carecompanion/api`
- [ ] Start command set: `cd apps/api && npm start`
- [ ] Watch paths set: `apps/api/**`

### Environment Variables
- [ ] `NODE_ENV=production`
- [ ] `PORT=3000`
- [ ] `DATABASE_URL=${{Postgres.DATABASE_URL}}`
- [ ] `REDIS_URL=${{Redis.REDIS_URL}}`
- [ ] `CLERK_PUBLISHABLE_KEY` (from Clerk dashboard)
- [ ] `CLERK_SECRET_KEY` (from Clerk dashboard)
- [ ] `OPENAI_API_KEY` (from OpenAI)
- [ ] `AWS_ACCESS_KEY_ID` (from AWS)
- [ ] `AWS_SECRET_ACCESS_KEY` (from AWS)
- [ ] `AWS_REGION=us-east-1`
- [ ] `S3_BUCKET_NAME=carecompanion-documents`
- [ ] `FRONTEND_URL` (your Vercel URL)
- [ ] `LOG_LEVEL=info`

### Database Setup
- [ ] Migrations run: `railway run npm run db:migrate`
- [ ] Database connection verified
- [ ] Test query successful

### Deployment
- [ ] API deployed successfully
- [ ] Health check works: `curl https://your-app.up.railway.app/health`
- [ ] Logs show no errors
- [ ] Background jobs initialized

## AWS Setup

### S3 Bucket
- [ ] Bucket created: `carecompanion-documents`
- [ ] CORS configured with frontend and backend URLs
- [ ] IAM user created with S3 permissions
- [ ] Access keys generated
- [ ] Test upload works

## Clerk Setup

### Application Configuration
- [ ] Clerk application created
- [ ] Frontend URL added to allowed origins
- [ ] Backend URL added to allowed origins
- [ ] API keys copied
- [ ] Test sign-up works

## Vercel Setup (Frontend)

### Project Configuration
- [ ] Vercel account created
- [ ] Repository imported
- [ ] Root directory set to `apps/web`
- [ ] Build command: `npm run build`
- [ ] Output directory: `dist`
- [ ] Install command: `cd ../.. && npm install`

### Environment Variables
- [ ] `VITE_API_URL` (Railway backend URL)
- [ ] `VITE_CLERK_PUBLISHABLE_KEY` (same as backend)

### Deployment
- [ ] Initial deployment successful
- [ ] Frontend loads in browser
- [ ] No console errors
- [ ] Assets loading correctly

## Integration Testing

### Authentication
- [ ] Sign up works
- [ ] Sign in works
- [ ] Sign out works
- [ ] Protected routes work

### API Communication
- [ ] Frontend can reach backend
- [ ] CORS working correctly
- [ ] Auth headers passing through
- [ ] API responses returning correctly

### Features
- [ ] Patient management works
- [ ] Medication tracking works
- [ ] File uploads to S3 work
- [ ] Calendar/scheduling works
- [ ] Journal entries work

### Performance
- [ ] Page load times acceptable
- [ ] API response times good
- [ ] No memory leaks
- [ ] Background jobs processing

## Post-Deployment

### Monitoring
- [ ] Railway logs monitoring setup
- [ ] Vercel analytics enabled
- [ ] Error tracking configured (optional: Sentry)
- [ ] Uptime monitoring (optional: UptimeRobot)

### Security
- [ ] Environment variables secured
- [ ] API rate limiting enabled
- [ ] CORS properly configured
- [ ] HTTPS enforced

### Documentation
- [ ] Deployment URLs documented
- [ ] Environment variables documented
- [ ] Team has access to necessary dashboards
- [ ] Rollback procedure understood

## Custom Domain (Optional)

- [ ] Domain purchased
- [ ] DNS configured for Vercel
- [ ] SSL certificate issued
- [ ] Domain verified and working

## Backup & Recovery

- [ ] Database backup strategy defined
- [ ] Railway automated backups enabled
- [ ] Rollback tested
- [ ] Disaster recovery plan documented

## Notes

Add any deployment-specific notes or issues here:

---

**Railway API URL**: https://_____________________.up.railway.app

**Vercel Frontend URL**: https://_____________________.vercel.app

**Deployment Date**: ____________________

**Deployed By**: ____________________
