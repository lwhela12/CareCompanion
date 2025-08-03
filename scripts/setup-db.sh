#!/bin/bash

# Database setup and health check script for CareCompanion
# This script ensures the database is properly configured and healthy

set -e

echo "🏥 CareCompanion Database Setup"
echo "================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

echo "✅ Docker is running"

# Check if containers are running
if ! docker ps | grep -q carecompanion-postgres; then
    echo "🚀 Starting database containers..."
    docker-compose up -d
    echo "⏳ Waiting for PostgreSQL to be ready..."
    sleep 5
else
    echo "✅ PostgreSQL container is running"
fi

# Wait for PostgreSQL to be healthy
echo "🔍 Checking database health..."
RETRIES=30
until docker exec carecompanion-postgres pg_isready -U postgres > /dev/null 2>&1; do
    RETRIES=$((RETRIES - 1))
    if [ $RETRIES -le 0 ]; then
        echo "❌ PostgreSQL failed to start"
        exit 1
    fi
    echo "⏳ Waiting for PostgreSQL... ($RETRIES retries left)"
    sleep 1
done

echo "✅ PostgreSQL is ready"

# Check if database exists
if ! docker exec carecompanion-postgres psql -U postgres -lqt | cut -d \| -f 1 | grep -qw carecompanion; then
    echo "❌ Database 'carecompanion' does not exist"
    echo "Creating database..."
    docker exec carecompanion-postgres createdb -U postgres carecompanion
fi

echo "✅ Database 'carecompanion' exists"

# Check schema location (should be public)
SCHEMA_CHECK=$(docker exec carecompanion-postgres psql -U postgres -d carecompanion -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users';")
SCHEMA_CHECK=$(echo $SCHEMA_CHECK | tr -d ' ')

if [ "$SCHEMA_CHECK" = "0" ]; then
    echo "⚠️  Tables not found in public schema"
    echo "Running migrations..."
    npm run db:migrate
else
    echo "✅ Tables found in public schema"
fi

# Verify connection with Prisma
echo "🔗 Testing Prisma connection..."
cd packages/database
if npx prisma db pull --print > /dev/null 2>&1; then
    echo "✅ Prisma can connect to the database"
else
    echo "❌ Prisma connection failed"
    exit 1
fi

cd ../..

# Final health check
echo ""
echo "🎉 Database setup complete!"
echo ""
echo "Summary:"
echo "--------"
docker exec carecompanion-postgres psql -U postgres -d carecompanion -c "
SELECT 
    'Tables' as metric,
    COUNT(*) as count 
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE '\_%'
UNION ALL
SELECT 
    'Users' as metric,
    COUNT(*) 
FROM users
UNION ALL
SELECT 
    'Families' as metric,
    COUNT(*) 
FROM families;"

echo ""
echo "You can now run: npm run dev"