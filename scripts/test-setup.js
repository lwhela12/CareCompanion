#!/usr/bin/env node

/**
 * Quick test setup script for development
 * Usage: node scripts/test-setup.js
 */

console.log(`
🧪 CareCompanion Testing Guide
==============================

1. START THE APP
   npm run dev

2. TEST NEW USER ONBOARDING
   - Open http://localhost:5173
   - Sign up with a new email
   - Complete the 3-step onboarding:
     • Welcome screen
     • Family name (e.g., "The Test Family")
     • Patient info (Mom's details)

3. TEST INVITATIONS
   - Go to Family page
   - Click "Invite Member"
   - Use a different email
   - Check console for email preview link

4. QUICK TIPS
   - Use email+alias@gmail.com for multiple test accounts
   - Check API console for invitation links
   - Use incognito windows for different users

5. COMMON ISSUES
   - If stuck on loading: Check if API is running (port 3000)
   - If onboarding loops: Clear localStorage and cookies
   - If invitation fails: Check API logs for errors

📧 In development, emails show in the API console as preview URLs
🔑 Both Clerk keys must be valid in .env files
`);

// Check if services are running
const http = require('http');

function checkService(url, name) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      console.log(`✅ ${name} is running`);
      resolve(true);
    }).on('error', () => {
      console.log(`❌ ${name} is not running`);
      resolve(false);
    });
  });
}

async function checkServices() {
  console.log('\nChecking services...\n');
  
  const apiRunning = await checkService('http://localhost:3000/health', 'API');
  const webRunning = await checkService('http://localhost:5173', 'Web App');
  
  if (!apiRunning || !webRunning) {
    console.log('\n⚠️  Make sure to run: npm run dev\n');
  } else {
    console.log('\n✨ All services are running! Ready to test.\n');
  }
}

checkServices();