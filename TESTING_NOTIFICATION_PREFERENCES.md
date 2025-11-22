# Notification Preferences Testing Guide

This guide covers comprehensive testing of the notification preferences system.

## Prerequisites

1. **Start the development servers:**
   ```bash
   # Terminal 1 - Backend API
   cd /Users/lucaswhelan/CareCompanion/apps/api
   npm run dev

   # Terminal 2 - Frontend
   cd /Users/lucaswhelan/CareCompanion/apps/web
   npm run dev

   # Terminal 3 - Background Jobs (if not auto-started)
   # Jobs should auto-start with the API server
   ```

2. **Verify services are running:**
   - API: http://localhost:3000
   - Frontend: http://localhost:5173
   - Database: PostgreSQL running
   - Redis: Running for background jobs

---

## Test Suite 1: Backend API Endpoints

### Test 1.1: GET Preferences (Default Values)

**Objective:** Verify new users get default preferences

**Steps:**
1. Sign in to the app
2. Open browser DevTools → Network tab
3. Make a request to get preferences:

```bash
# Get your auth token from any API request in Network tab
# Look for Authorization header: Bearer <token>

curl -X GET http://localhost:3000/api/v1/users/notification-preferences \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "preferences": {
    "emailEnabled": true,
    "medicationReminders": true,
    "careTaskReminders": true,
    "insightAlerts": true,
    "dailySummaries": false,
    "weeklyReports": false,
    "quietHoursEnabled": false,
    "quietHoursStart": null,
    "quietHoursEnd": null,
    "quietHoursTimezone": null,
    "smsEnabled": false,
    "phoneNumber": null,
    "pushEnabled": false
  }
}
```

✅ **Pass Criteria:**
- 200 OK status
- All critical notifications ON (medication, careTask)
- Optional notifications OFF (summaries, reports)
- Quiet hours disabled

---

### Test 1.2: PATCH Preferences (Update)

**Objective:** Verify preferences can be updated

**Steps:**
```bash
curl -X PATCH http://localhost:3000/api/v1/users/notification-preferences \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "medicationReminders": false,
    "dailySummaries": true
  }'
```

**Expected Response:**
```json
{
  "message": "Notification preferences updated successfully",
  "preferences": {
    "emailEnabled": true,
    "medicationReminders": false,  // ← Changed
    "careTaskReminders": true,
    "insightAlerts": true,
    "dailySummaries": true,        // ← Changed
    ...
  }
}
```

✅ **Pass Criteria:**
- 200 OK status
- Updated fields reflected
- Other fields unchanged

---

### Test 1.3: PATCH Preferences (Quiet Hours)

**Objective:** Verify quiet hours can be configured

**Steps:**
```bash
curl -X PATCH http://localhost:3000/api/v1/users/notification-preferences \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "quietHoursEnabled": true,
    "quietHoursStart": "22:00",
    "quietHoursEnd": "08:00",
    "quietHoursTimezone": "America/Los_Angeles"
  }'
```

**Expected Response:**
```json
{
  "message": "Notification preferences updated successfully",
  "preferences": {
    "quietHoursEnabled": true,
    "quietHoursStart": "22:00",
    "quietHoursEnd": "08:00",
    "quietHoursTimezone": "America/Los_Angeles",
    ...
  }
}
```

✅ **Pass Criteria:**
- 200 OK status
- All quiet hours fields set correctly

---

### Test 1.4: PATCH Validation (Incomplete Quiet Hours)

**Objective:** Verify validation rejects incomplete quiet hours

**Steps:**
```bash
curl -X PATCH http://localhost:3000/api/v1/users/notification-preferences \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "quietHoursEnabled": true,
    "quietHoursStart": "22:00"
  }'
```

**Expected Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Quiet hours requires start time, end time, and timezone",
    "statusCode": 400
  }
}
```

✅ **Pass Criteria:**
- 400 Bad Request status
- Clear error message

---

### Test 1.5: Database Persistence

**Objective:** Verify preferences are saved to database

**Steps:**
1. Update preferences via API (Test 1.2)
2. Check database:

```sql
-- Connect to your database
psql -d carecompanion

-- Query user preferences
SELECT
  email,
  notification_preferences
FROM users
WHERE email = 'your@email.com';
```

**Expected Result:**
```
 email              | notification_preferences
--------------------+---------------------------
 your@email.com     | {"emailEnabled": true, "medicationReminders": false, ...}
```

✅ **Pass Criteria:**
- JSON field populated
- Values match what you set via API

---

## Test Suite 2: Frontend Settings Page

### Test 2.1: Page Load

**Objective:** Verify Settings page loads correctly

**Steps:**
1. Navigate to http://localhost:5173
2. Sign in
3. Click "Settings" in sidebar (bottom of menu)

✅ **Pass Criteria:**
- Page loads without errors
- "Notifications" tab is active
- All toggles render
- Current preferences loaded (spinner → content)

---

### Test 2.2: Toggle Interactions

**Objective:** Verify toggles work correctly

**Steps:**
1. Toggle "Medication Reminders" OFF
2. Verify toggle changes visually
3. Click "Save Preferences"
4. Wait for success message

✅ **Pass Criteria:**
- Toggle switches smoothly
- "Saving..." spinner shows
- Green success banner appears
- Toast notification: "Preferences saved!"

---

### Test 2.3: Quiet Hours Configuration

**Objective:** Verify quiet hours UI works

**Steps:**
1. Toggle "Quiet Hours" ON
2. Verify time pickers appear
3. Set start time: 22:00
4. Set end time: 08:00
5. Select timezone: "Pacific Time (PT)"
6. Verify preview text updates
7. Click "Save Preferences"

✅ **Pass Criteria:**
- Time pickers appear when enabled
- Timezone dropdown has 7 options
- Preview shows "22:00 - 08:00"
- Save succeeds

---

### Test 2.4: Validation (Incomplete Quiet Hours)

**Objective:** Verify frontend validates quiet hours

**Steps:**
1. Toggle "Quiet Hours" ON
2. Set start time: 22:00
3. Leave end time empty
4. Click "Save Preferences"

✅ **Pass Criteria:**
- Red error banner appears
- Error message: "Please configure all quiet hours settings..."
- Toast error: "Complete quiet hours configuration"
- Save does not proceed

---

### Test 2.5: Master Toggle Disables Others

**Objective:** Verify master email toggle disables sub-toggles

**Steps:**
1. Toggle "Email Notifications" OFF
2. Verify all notification type toggles become disabled (grayed out)
3. Try clicking a disabled toggle
4. Toggle "Email Notifications" back ON
5. Verify toggles become enabled again

✅ **Pass Criteria:**
- Toggles visually disabled when master is OFF
- Cannot toggle disabled switches
- Re-enabling master re-enables toggles

---

### Test 2.6: Reset Button

**Objective:** Verify Reset button reverts changes

**Steps:**
1. Change several settings (don't save)
2. Click "Reset" button
3. Verify settings revert to saved state

✅ **Pass Criteria:**
- Page reloads preferences from API
- All changes discarded
- Shows loading spinner briefly

---

## Test Suite 3: Worker Integration

### Test 3.1: Medication Reminder Respects Preferences

**Objective:** Verify worker filters by preferences

**Setup:**
1. Create a medication for your test patient
2. Set schedule for 30 minutes from now
3. Disable medication reminders in Settings

**Steps:**
1. Update preferences to disable medication reminders:
   ```bash
   curl -X PATCH http://localhost:3000/api/v1/users/notification-preferences \
     -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     -H "Content-Type: application/json" \
     -d '{"medicationReminders": false}'
   ```

2. Wait for next worker run (every 15 minutes)
3. Check API logs:
   ```bash
   # In your API terminal, look for:
   "Medication reminder sent"
   "recipientCount": 0    # ← Should be 0 if you're the only caregiver
   "filteredCount": 1     # ← Should be 1 (you were filtered out)
   ```

✅ **Pass Criteria:**
- No email received
- Logs show user was filtered out
- filteredCount > 0

---

### Test 3.2: Primary Caregiver Safety Override

**Objective:** Verify primary caregiver receives reminders even when disabled

**Setup:**
1. Ensure you're the primary_caregiver for the family
2. Disable medication reminders
3. No other caregivers in family

**Steps:**
1. Create medication scheduled for 30 minutes from now
2. Wait for worker run
3. Check logs for:
   ```
   "All caregivers disabled medication reminders, sending to primary anyway"
   ```

✅ **Pass Criteria:**
- Warning logged
- Email still sent to primary caregiver
- recipientCount: 1

---

### Test 3.3: Quiet Hours Blocks Notifications

**Objective:** Verify quiet hours prevents notifications

**Setup:**
1. Set quiet hours: 00:00 - 23:59 (all day)
2. Create medication for 30 mins from now

**Steps:**
1. Configure all-day quiet hours:
   ```bash
   curl -X PATCH http://localhost:3000/api/v1/users/notification-preferences \
     -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     -H "Content-Type: application/json" \
     -d '{
       "quietHoursEnabled": true,
       "quietHoursStart": "00:00",
       "quietHoursEnd": "23:59",
       "quietHoursTimezone": "America/Los_Angeles"
     }'
   ```

2. Wait for worker run
3. Check logs for:
   ```
   "Notification blocked by quiet hours"
   ```

✅ **Pass Criteria:**
- No email sent
- Logs show quiet hours blocked notification
- filteredCount > 0

---

### Test 3.4: Timezone Handling (Overnight Quiet Hours)

**Objective:** Verify overnight quiet hours work (22:00 - 08:00)

**Setup:**
1. Set quiet hours: 22:00 - 08:00
2. Current time in your timezone: 23:00 (11 PM)

**Steps:**
1. Set overnight quiet hours:
   ```bash
   curl -X PATCH http://localhost:3000/api/v1/users/notification-preferences \
     -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     -H "Content-Type: application/json" \
     -d '{
       "quietHoursEnabled": true,
       "quietHoursStart": "22:00",
       "quietHoursEnd": "08:00",
       "quietHoursTimezone": "America/Los_Angeles"
     }'
   ```

2. Test at 23:00 (should block)
3. Test at 09:00 (should allow)

✅ **Pass Criteria:**
- 23:00 notifications blocked
- 09:00 notifications allowed
- Overnight logic works correctly

---

## Test Suite 4: Edge Cases

### Test 4.1: Multiple Caregivers with Different Preferences

**Objective:** Verify each user's preferences respected independently

**Setup:**
1. Invite a second caregiver to your family
2. Second caregiver disables medication reminders
3. You keep medication reminders enabled

**Steps:**
1. Create medication for 30 mins
2. Wait for worker run
3. Verify only YOU receive email

✅ **Pass Criteria:**
- Only caregivers with enabled preferences receive emails
- Logs show correct filtering

---

### Test 4.2: Re-enabling After Disabling

**Objective:** Verify re-enabling works immediately

**Steps:**
1. Disable medication reminders
2. Create medication for 30 mins
3. Immediately re-enable medication reminders
4. Wait for worker run

✅ **Pass Criteria:**
- Email received (preferences checked on each run)
- No caching issues

---

### Test 4.3: Concurrent Updates

**Objective:** Verify last-write-wins for concurrent updates

**Steps:**
1. Open Settings in two browser tabs
2. Tab 1: Disable medication reminders, save
3. Tab 2: Enable daily summaries, save
4. Refresh both tabs

✅ **Pass Criteria:**
- Last save wins
- No data corruption
- Both tabs show same state after refresh

---

## Test Suite 5: Performance & Reliability

### Test 5.1: Preferences Service Failure Handling

**Objective:** Verify worker continues if preferences check fails

**Steps:**
1. Stop database temporarily
2. Wait for worker run
3. Check logs

**Expected Behavior:**
```
"Error checking notification preferences"
```

✅ **Pass Criteria:**
- Worker doesn't crash
- Notification sent anyway (fail-open design)
- Error logged

---

### Test 5.2: Load Test (Multiple Users)

**Objective:** Verify performance with many users

**Setup:**
Create test script to add 100 users with medications

**Steps:**
1. Insert 100 test users
2. Create medications for each
3. Wait for worker run
4. Measure processing time

✅ **Pass Criteria:**
- Worker completes within reasonable time (<1 minute for 100 users)
- No timeout errors
- All preferences checked correctly

---

## Test Suite 6: End-to-End User Flows

### Test 6.1: New User Onboarding

**Objective:** Full flow from signup to receiving notification

**Steps:**
1. Create new account
2. Complete onboarding
3. Add patient
4. Add medication scheduled for 30 mins
5. Wait for reminder

✅ **Pass Criteria:**
- Default preferences applied
- Medication reminder received
- No configuration needed for basic use

---

### Test 6.2: Caregiver Configuring Quiet Hours

**Objective:** Realistic user flow

**Steps:**
1. Sign in as existing user
2. Navigate to Settings
3. Enable quiet hours for nighttime (22:00 - 08:00)
4. Save preferences
5. Schedule medication during quiet hours
6. Schedule medication outside quiet hours
7. Verify only the second one sends

✅ **Pass Criteria:**
- UI is intuitive
- Changes persist
- Quiet hours work as expected

---

## Test Suite 7: Database Validation

### Test 7.1: Schema Validation

**Steps:**
```sql
-- Verify field exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name = 'notification_preferences';

-- Expected:
-- column_name               | data_type
-- notification_preferences  | jsonb
```

### Test 7.2: Migration Integrity

**Steps:**
```sql
-- Check migration applied
SELECT * FROM _prisma_migrations
WHERE migration_name LIKE '%notification_preferences%';

-- Expected: 1 row with finished_at timestamp
```

---

## Checklist Summary

### Backend Tests
- [ ] GET preferences returns defaults
- [ ] PATCH updates preferences
- [ ] PATCH validates quiet hours
- [ ] Validation rejects invalid input
- [ ] Database persists changes

### Frontend Tests
- [ ] Settings page loads
- [ ] Toggles work correctly
- [ ] Quiet hours UI functions
- [ ] Validation shows errors
- [ ] Master toggle disables others
- [ ] Reset button works
- [ ] Save button with loading state

### Worker Tests
- [ ] Medication worker filters by preferences
- [ ] Primary caregiver override works
- [ ] Quiet hours blocks notifications
- [ ] Timezone handling works
- [ ] Overnight quiet hours work

### Edge Cases
- [ ] Multiple caregivers with different preferences
- [ ] Re-enabling works immediately
- [ ] No data corruption on concurrent updates
- [ ] Worker fails gracefully on errors

### End-to-End
- [ ] New user gets default preferences
- [ ] User can configure quiet hours
- [ ] Preferences persist across sessions
- [ ] Medication reminders respect settings

---

## Debugging Tips

### If preferences don't save:
1. Check browser console for errors
2. Check API logs for validation errors
3. Verify token is valid
4. Check database connection

### If worker doesn't respect preferences:
1. Check worker logs: `npm run dev` (API terminal)
2. Verify preferences in database
3. Check `shouldSendNotification` is being called
4. Verify timezone conversion logic

### If quiet hours don't work:
1. Verify timezone matches your current timezone
2. Check system time vs. quiet hours window
3. Look for "blocked by quiet hours" in logs
4. Test with simpler hours first (09:00 - 17:00)

---

## Success Criteria

All tests should pass for the feature to be considered production-ready. Document any failures and fix before deploying.

**Estimated Testing Time:** 1-2 hours for complete suite
**Priority Tests:** Test Suites 1, 2, and 3 (Backend, Frontend, Worker)
