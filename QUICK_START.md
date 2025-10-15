# 🚀 Quick Start Guide

## One-Command Setup

```bash
npm install              # First time only
npm run start:full       # Magic! ✨
```

That's it! Everything starts in one terminal with colored output.

---

## What You'll See

```
╔════════════════════════════════════════════╗
║                                            ║
║      🏥 CareCompanion Dev Setup          ║
║                                            ║
╚════════════════════════════════════════════╝

[1/6] Checking Docker...
✓ Docker is running

[2/6] Checking AWS CLI...
✓ AWS CLI is installed

[3/6] Starting Docker services...
✓ Services started

[4/6] Initializing LocalStack S3...
✓ Bucket created

[5/6] Checking dependencies...
✓ Dependencies installed

[6/6] Starting application...

════════════════════════════════════════════
✨ All services are ready!

  🌐 Web:      http://localhost:5173
  🔌 API:      http://localhost:3000
  🗄️  Database:  localhost:5432
  📦 S3:       http://localhost:4566

════════════════════════════════════════════

[API] Server running on port 3000...
[WEB] Local: http://localhost:5173/
```

---

## Other Useful Commands

```bash
# If Docker is already running:
npm start

# Just API (separate terminal):
npm run dev:api

# Just Web (separate terminal):
npm run dev:web

# Stop everything:
# Press Ctrl+C in the terminal
# Then: docker-compose down
```

---

## Troubleshooting

**"Docker not found"**
→ Install Docker Desktop: https://www.docker.com/products/docker-desktop/

**"Docker is not running"**
→ Start Docker Desktop application

**"AWS CLI not found"**
→ `brew install awscli` (macOS)
→ Script will continue anyway (skips LocalStack init)

**"Port already in use"**
→ Kill the process:
```bash
lsof -ti :3000 | xargs kill -9  # API
lsof -ti :5173 | xargs kill -9  # Web
```

**"Something else is wrong"**
→ Nuclear option (reset everything):
```bash
docker-compose down -v
npm run start:full
```

---

## What Gets Started

✅ **PostgreSQL** - Database (port 5432)
✅ **Redis** - Caching/queues (port 6379)
✅ **LocalStack** - Local S3 (port 4566)
✅ **API Server** - Express backend (port 3000)
✅ **Web App** - React frontend (port 5173)

---

## Next Steps

1. Open http://localhost:5173
2. Sign up for an account
3. Try these features:
   - ✅ Medication check-off (Dashboard page)
   - ✅ Upload documents (Click "Upload Document")
   - ✅ Add medications
   - ✅ Journal entries
   - ✅ Care tasks

---

## Pro Tips

**View uploaded files:**
```bash
aws s3 ls s3://carecompanion-documents --endpoint-url=http://localhost:4566 --recursive
```

**Database GUI:**
```bash
npm run db:studio
# Opens at http://localhost:5555
```

**Check what's running:**
```bash
docker ps
```

**View logs:**
```bash
docker logs carecompanion-postgres
docker logs carecompanion-localstack
docker logs carecompanion-redis
```

**Stop everything cleanly:**
```bash
# 1. Press Ctrl+C in your npm terminal
# 2. Then stop Docker:
docker-compose down

# To also delete all data:
docker-compose down -v
```

---

## Still Stuck?

Check the full documentation:
- `README.md` - Complete setup guide
- `LOCALSTACK_SETUP.md` - S3/LocalStack details
- `CLAUDE.md` - Development guidelines

Or just ask! 😊
