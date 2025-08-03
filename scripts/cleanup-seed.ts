import { prisma } from '@carecompanion/database';

async function cleanupSeedData() {
  console.log('🧹 Cleaning up existing seed data...');

  try {
    // Find the Munson family
    const munsonFamily = await prisma.family.findFirst({
      where: { name: 'Munson Family' },
      include: {
        members: true,
        patient: true
      }
    });

    if (!munsonFamily) {
      console.log('ℹ️  No Munson Family found to clean up.');
      return;
    }

    console.log(`🗑️  Found Munson Family (${munsonFamily.id}), cleaning up...`);

    // Delete all related data (cascading deletes should handle most of this)
    await prisma.family.delete({
      where: { id: munsonFamily.id }
    });

    // Also clean up any orphaned users that were created by the seed
    const orphanedUsers = await prisma.user.findMany({
      where: {
        email: {
          in: ['nic@test.com', 'michael@test.com', 'jay@test.com']
        },
        clerkId: {
          startsWith: 'user_mock_'
        }
      }
    });

    if (orphanedUsers.length > 0) {
      console.log(`🗑️  Removing ${orphanedUsers.length} orphaned mock users...`);
      await prisma.user.deleteMany({
        where: {
          id: {
            in: orphanedUsers.map(u => u.id)
          }
        }
      });
    }

    console.log('✅ Cleanup completed successfully!');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

async function main() {
  try {
    await cleanupSeedData();
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { cleanupSeedData };