# Testing Patient Portal Invitations

This guide explains how to test the patient portal invitation flow when using test emails (emails that can't receive real emails in Clerk).

## Architecture Overview

### User Roles - Two Concepts

**1. User Type** (determines which portal):
- `CAREGIVER` → sees /dashboard (care management portal)
- `PATIENT` → sees /patient (simplified patient portal)

**2. Family Role** (determines permissions within a family):
- `primary_caregiver` → Full access
- `caregiver` → Can manage care
- `family_member` → Can view and add updates
- `read_only` → View only (typically for patients)

**Important:** ALL users (including patients) have FamilyMember records. Patients also have `linkedPatientId` pointing to their Patient record.

## The Problem

When testing locally with test emails like `sue@test.com`, you can't receive the invitation email, which means you can't click the invitation link. This makes testing the patient portal flow difficult.

## The Solution

We've created a **Dev Invitations Page** that lists all pending invitations and allows you to accept them directly without needing email access.

## How to Test Patient Portal Access

### Critical Rules

1. **Email Must Match**: Only the person whose email matches the invitation can accept it
2. **Sign Out First**: Always sign out before accepting an invitation for a different email
3. **One Account Per Email**: Each email can only have one user account

### Step 1: Send the Invitation

1. Log in as a caregiver (e.g., `nic@test.com`)
2. Go to **Family** page
3. In the **Patient Portal Access** card, click **Send Portal Invitation**
4. Enter the patient's test email (e.g., `sue@test.com`)
5. Click **Send Invitation**

The invitation is now created in the database!

**Important:** If you try to accept this while still logged in as the caregiver, you'll get an error: "This invitation is for sue@test.com. Please sign in with that email address to accept this invitation."

### Step 2: Access the Dev Invitations Page

There are two ways to access it:

**Option A: Via Sidebar (Development Mode)**
- In the sidebar, scroll down to the "Dev Tools" section
- Click **Dev: Invitations**

**Option B: Via URL**
- Navigate directly to `/dev/invitations`

### Step 3: Accept the Invitation

1. On the Dev Invitations page, you'll see all pending invitations
2. Find the invitation for `sue@test.com`
3. You have two options:

   **Option A: Accept Now (Recommended for Testing)**
   - Make sure you're signed out or in a different browser/incognito window
   - Sign up in Clerk with `sue@test.com`
   - Log in as `sue@test.com`
   - Go back to `/dev/invitations`
   - Click **Accept Now** for Sue's invitation
   - You'll be redirected to accept the invitation and set up as a PATIENT user
   - Finally redirected to `/patient` portal

   **Option B: Copy Link**
   - Click **Copy Link** to copy the invitation URL
   - Sign out
   - Sign up in Clerk with `sue@test.com`
   - Paste the invitation URL in your browser
   - Accept the invitation

### Step 4: Verify Patient Portal

After accepting the invitation:
- Sue should be set up as a **PATIENT** user type
- She should have a **FamilyMember** record with `read_only` role
- She should have `linkedPatientId` pointing to the Munson family patient
- She should be redirected to `/patient` portal
- She should see her daily checklist
- She should NOT see the caregiver dashboard

Verify with:
```bash
npm run check-user -- sue@test.com
```

Expected output:
```
User Type: PATIENT
Linked Patient ID: [some-uuid]
Family Memberships: 1
   - Munson Family (read_only, patient)
```

## Testing Multiple Invitations

You can test different scenarios:

1. **Patient Invitation**: `sue@test.com` (PATIENT user)
2. **Caregiver Invitation**: `another-caregiver@test.com` (CAREGIVER user)
3. **Family Member Invitation**: `family@test.com` (CAREGIVER user with limited access)

The Dev Invitations page shows all pending invitations with their type (PATIENT or CAREGIVER) for easy identification.

## Cleanup

If you need to reset a test user:

```bash
npm run cleanup-user -- sue@test.com
```

This will:
- Delete the user from the database
- Clean up all related records (audit logs, family members, etc.)
- Remove any pending invitations
- Allow you to start fresh

## Auto-Redirect Feature

The system also has an **auto-redirect feature** for pending invitations:

1. When a user signs up with an email that has a pending invitation
2. They log in for the first time
3. The `RootRedirect` component checks for pending invitations
4. If found, it automatically redirects them to `/invitation/{token}`

**However**, this relies on the `/api/v1/families` endpoint returning the pending invitation, which happens when:
- The user logs in
- The backend finds the user's Clerk account
- It checks for invitations matching their email

For testing purposes, the Dev Invitations page is more reliable since it doesn't depend on timing or caching issues.

## Dev Invitations Page Features

- **View All Invitations**: See all pending invitations across all families
- **Filter by Email**: Quickly find specific invitations
- **Invitation Details**: See family name, role, relationship, expiration
- **Accept Directly**: Accept an invitation without email
- **Copy Link**: Get the direct invitation URL for manual testing
- **Refresh**: Reload the list to see newly created invitations

## Security Note

The `/api/v1/invitations/all` endpoint is a **dev-only** feature and should NOT be enabled in production. In production, users should only be able to see invitations for their own families.

## Troubleshooting

### "This invitation is for..." Error
**Cause:** You're trying to accept an invitation while logged in with a different email.
**Solution:** Sign out, then sign in/up with the invited email address.

### "User already has access" Error
**Cause:** The user already exists in the database with that email.
**Solution:** Run the cleanup script: `npm run cleanup-user -- <email>`

### "Invitation not found" Error
**Cause:** The invitation might have expired or been used.
**Solution:**
- Check the expiration date on the Dev Invitations page
- Check if invitation was already accepted
- Create a new invitation

### Patient Sees Caregiver Dashboard
**Cause:** User was created as CAREGIVER type (probably went through onboarding instead of invitation).
**Solution:**
1. Delete the user: `npm run cleanup-user -- <email>`
2. Ensure there's a pending invitation before signing up
3. Sign up with the invited email → should auto-redirect to accept invitation

### Auto-redirect Not Working
**Causes:**
- User already has a family (won't check for pending invitations)
- Invitation was already accepted
- Email doesn't match exactly (check case sensitivity)

**Solution:**
- Make sure you're fully logged out before signing up
- Clear browser cache/cookies
- Use incognito mode for testing
- Use the Dev Invitations page as a fallback

## Example Workflow

Here's a complete example of testing Sue's patient portal:

```bash
# 1. As nic@test.com (caregiver)
#    - Go to Family page
#    - Send invitation to sue@test.com

# 2. Clean up if Sue already exists
npm run cleanup-user -- sue@test.com

# 3. Sign out from nic@test.com

# 4. In incognito window or different browser:
#    - Go to your app
#    - Sign up with sue@test.com in Clerk
#    - Complete Clerk signup

# 5. After logging in as sue@test.com:
#    - Go to /dev/invitations
#    - Find Sue's invitation (will show PATIENT type)
#    - Click "Accept Now"

# 6. Verify:
#    - Should redirect to /patient
#    - Should see patient portal interface
#    - Should NOT see caregiver navigation
```

## Production Behavior

In production with real emails:
1. Caregiver sends invitation from Family page
2. Patient receives email with invitation link
3. Patient clicks link, signs up in Clerk
4. Patient is redirected to accept invitation
5. Patient is set up as PATIENT user and redirected to `/patient`

The dev page simply replaces steps 2-3 for testing purposes.
