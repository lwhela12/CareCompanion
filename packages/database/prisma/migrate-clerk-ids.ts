import { PrismaClient } from '@prisma/client';
import { clerkClient } from '@clerk/clerk-sdk-node';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from root .env
dotenv.config({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

async function migrateClerkIds() {
  console.log('Starting Clerk ID migration...');

  try {
    // Find all users with mock Clerk IDs
    const mockUsers = await prisma.user.findMany({
      where: {
        clerkId: {
          startsWith: 'user_mock_'
        }
      }
    });

    console.log(`Found ${mockUsers.length} users with mock Clerk IDs`);

    for (const user of mockUsers) {
      console.log(`\nProcessing user: ${user.email}`);

      try {
        // Search for Clerk user by email
        const clerkUsers = await clerkClient.users.getUserList({
          emailAddress: [user.email]
        });

        if (clerkUsers.length > 0) {
          const clerkUser = clerkUsers[0];
          console.log(`Found Clerk user with ID: ${clerkUser.id}`);

          // Update the user's Clerk ID
          await prisma.user.update({
            where: { id: user.id },
            data: { clerkId: clerkUser.id }
          });

          console.log(`✓ Updated ${user.email} with real Clerk ID`);
        } else {
          console.log(`✗ No Clerk account found for ${user.email}`);
        }
      } catch (error) {
        console.error(`Error processing ${user.email}:`, error);
      }
    }

    console.log('\nMigration completed!');

    // Show final status
    const remainingMockUsers = await prisma.user.count({
      where: {
        clerkId: {
          startsWith: 'user_mock_'
        }
      }
    });

    console.log(`\nRemaining users with mock IDs: ${remainingMockUsers}`);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateClerkIds();