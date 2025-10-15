#!/bin/bash

# Simple start script - runs API and Web in one terminal
# For full setup with Docker services, use: npm run start:full

set -e

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo -e "${GREEN}🚀 Starting CareCompanion Development...${NC}"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
    echo ""
fi

# Check if dependencies are installed in workspaces
if [ ! -d "apps/api/node_modules" ] || [ ! -d "apps/web/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing workspace dependencies...${NC}"
    npm install
    echo ""
fi

echo -e "${BLUE}Starting API and Web servers...${NC}"
echo ""
echo "API will be available at: http://localhost:3000"
echo "Web will be available at: http://localhost:5173"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Start both services with colored output
npm run dev:both
