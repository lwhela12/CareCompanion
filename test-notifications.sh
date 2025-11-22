#!/bin/bash

# Notification Preferences Testing Script
# Run this after starting the dev server and signing in

echo "==================================="
echo "Notification Preferences Test Suite"
echo "==================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if TOKEN is set
if [ -z "$TOKEN" ]; then
    echo -e "${RED}ERROR: TOKEN environment variable not set${NC}"
    echo ""
    echo "To get your token:"
    echo "1. Sign in to http://localhost:5173"
    echo "2. Open DevTools → Network tab"
    echo "3. Click any API request"
    echo "4. Copy the 'Authorization: Bearer <token>' header"
    echo "5. Run: export TOKEN='your_token_here'"
    echo ""
    exit 1
fi

API_URL="http://localhost:3000"

# Test 1: GET Preferences (Defaults)
echo "Test 1: GET Notification Preferences"
echo "--------------------------------------"
response=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/api/v1/users/notification-preferences" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Status: $http_code"
    echo "$body" | jq '.'
else
    echo -e "${RED}✗ FAIL${NC} - Status: $http_code"
    echo "$body"
fi
echo ""

# Test 2: PATCH Preferences (Disable Medication Reminders)
echo "Test 2: PATCH - Disable Medication Reminders"
echo "--------------------------------------"
response=$(curl -s -w "\n%{http_code}" -X PATCH "$API_URL/api/v1/users/notification-preferences" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"medicationReminders": false}')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Status: $http_code"
    echo "$body" | jq '.preferences | {medicationReminders}'
else
    echo -e "${RED}✗ FAIL${NC} - Status: $http_code"
    echo "$body"
fi
echo ""

# Test 3: PATCH - Enable Quiet Hours
echo "Test 3: PATCH - Enable Quiet Hours"
echo "--------------------------------------"
response=$(curl -s -w "\n%{http_code}" -X PATCH "$API_URL/api/v1/users/notification-preferences" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quietHoursEnabled": true,
    "quietHoursStart": "22:00",
    "quietHoursEnd": "08:00",
    "quietHoursTimezone": "America/Los_Angeles"
  }')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Status: $http_code"
    echo "$body" | jq '.preferences | {quietHoursEnabled, quietHoursStart, quietHoursEnd, quietHoursTimezone}'
else
    echo -e "${RED}✗ FAIL${NC} - Status: $http_code"
    echo "$body"
fi
echo ""

# Test 4: PATCH - Validation Error (Incomplete Quiet Hours)
echo "Test 4: PATCH - Validation Error (Incomplete Quiet Hours)"
echo "--------------------------------------"
response=$(curl -s -w "\n%{http_code}" -X PATCH "$API_URL/api/v1/users/notification-preferences" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quietHoursEnabled": true,
    "quietHoursStart": "22:00"
  }')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" == "400" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Status: $http_code (Expected 400)"
    echo "$body" | jq '.error.message'
else
    echo -e "${RED}✗ FAIL${NC} - Status: $http_code (Expected 400)"
    echo "$body"
fi
echo ""

# Test 5: Re-enable Medication Reminders
echo "Test 5: PATCH - Re-enable Medication Reminders"
echo "--------------------------------------"
response=$(curl -s -w "\n%{http_code}" -X PATCH "$API_URL/api/v1/users/notification-preferences" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"medicationReminders": true}')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Status: $http_code"
    echo "$body" | jq '.preferences.medicationReminders'
else
    echo -e "${RED}✗ FAIL${NC} - Status: $http_code"
    echo "$body"
fi
echo ""

# Final GET to verify all changes persisted
echo "Test 6: Final GET - Verify Persistence"
echo "--------------------------------------"
response=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/api/v1/users/notification-preferences" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Status: $http_code"
    echo "$body" | jq '.preferences | {
        emailEnabled,
        medicationReminders,
        quietHoursEnabled,
        quietHoursStart,
        quietHoursEnd,
        quietHoursTimezone
    }'
else
    echo -e "${RED}✗ FAIL${NC} - Status: $http_code"
    echo "$body"
fi
echo ""

echo "==================================="
echo "Test Suite Complete!"
echo "==================================="
echo ""
echo "Next Steps:"
echo "1. Test the frontend UI at http://localhost:5173/settings"
echo "2. Create a medication and test worker filtering"
echo "3. Verify quiet hours work with real notifications"
