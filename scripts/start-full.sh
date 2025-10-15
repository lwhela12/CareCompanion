#!/bin/bash

# Full start script - checks and starts all services including Docker
# This is your one-stop-shop for getting everything running!

set -e

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                            ║${NC}"
echo -e "${CYAN}║      ${GREEN}🏥 CareCompanion Dev Setup${CYAN}          ║${NC}"
echo -e "${CYAN}║                                            ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if Docker container is running
container_running() {
    docker ps --format '{{.Names}}' | grep -q "$1"
}

# Check Docker
echo -e "${BLUE}[1/6]${NC} Checking Docker..."
if ! command_exists docker; then
    echo -e "${RED}❌ Docker not found!${NC}"
    echo "   Please install Docker Desktop: https://www.docker.com/products/docker-desktop/"
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running!${NC}"
    echo "   Please start Docker Desktop"
    exit 1
fi
echo -e "${GREEN}✓${NC} Docker is running"
echo ""

# Check AWS CLI (needed for LocalStack init)
echo -e "${BLUE}[2/6]${NC} Checking AWS CLI..."
if ! command_exists aws; then
    echo -e "${YELLOW}⚠️  AWS CLI not found${NC}"
    echo "   Install it for LocalStack: brew install awscli (macOS)"
    echo "   Skipping LocalStack initialization..."
    SKIP_LOCALSTACK=true
else
    echo -e "${GREEN}✓${NC} AWS CLI is installed"
fi
echo ""

# Start Docker services
echo -e "${BLUE}[3/6]${NC} Starting Docker services..."
if container_running "carecompanion-postgres" && container_running "carecompanion-redis"; then
    echo -e "${GREEN}✓${NC} Services already running"
else
    echo "   Starting PostgreSQL, Redis, and LocalStack..."
    docker-compose up -d
    echo "   Waiting for services to be ready..."
    sleep 5
    echo -e "${GREEN}✓${NC} Services started"
fi
echo ""

# Initialize LocalStack
if [ "$SKIP_LOCALSTACK" != true ]; then
    echo -e "${BLUE}[4/6]${NC} Initializing LocalStack S3..."
    if [ -f "./scripts/init-localstack.sh" ]; then
        ./scripts/init-localstack.sh || {
            echo -e "${YELLOW}⚠️  LocalStack init failed${NC}"
            echo -e "${YELLOW}   Document uploads won't work, but you can continue developing${NC}"
            echo ""
            echo -e "${CYAN}   To fix later, run:${NC}"
            echo -e "   ${CYAN}docker-compose restart localstack${NC}"
            echo -e "   ${CYAN}./scripts/init-localstack.sh${NC}"
            echo ""
        }
    else
        echo -e "${YELLOW}⚠️  Init script not found, skipping...${NC}"
    fi
else
    echo -e "${BLUE}[4/6]${NC} Skipping LocalStack initialization"
fi
echo ""

# Install dependencies
echo -e "${BLUE}[5/6]${NC} Checking dependencies..."
if [ ! -d "node_modules" ] || [ ! -d "apps/api/node_modules" ] || [ ! -d "apps/web/node_modules" ]; then
    echo "   Installing dependencies (this may take a minute)..."
    npm install
    echo -e "${GREEN}✓${NC} Dependencies installed"
else
    echo -e "${GREEN}✓${NC} Dependencies already installed"
fi
echo ""

# Start application services
echo -e "${BLUE}[6/6]${NC} Starting application..."
echo ""
echo -e "${CYAN}════════════════════════════════════════════${NC}"
echo -e "${GREEN}✨ All services are ready!${NC}"
echo ""
echo -e "  🌐 ${CYAN}Web:${NC}      http://localhost:5173"
echo -e "  🔌 ${CYAN}API:${NC}      http://localhost:3000"
echo -e "  🗄️  ${CYAN}Database:${NC}  localhost:5432"
echo -e "  📦 ${CYAN}S3:${NC}       http://localhost:4566"
echo ""
echo -e "${CYAN}════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}💡 Tip: Press Ctrl+C to stop all services${NC}"
echo ""
sleep 2

# Start both API and Web with colored output
npm run dev:both
