import { prisma } from '@carecompanion/database';

/**
 * Script to fix a user's type and details
 */

async function fixUserType(
  email: string,
  updates: {
    firstName?: string;
    lastName?: string;
    userType?: 'CAREGIVER' | 'PATIENT';
    linkedPatientId?: string | null;
  }
) {
  console.log(`🔧 Fixing user: ${email}`);

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log(`❌ No user found with email: ${email}`);
      return;
    }

    console.log(`\n📋 Current Details:`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);
    console.log(`   User Type: ${user.userType}`);
    console.log(`   Linked Patient ID: ${user.linkedPatientId || 'None'}`);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updates,
    });

    console.log(`\n✅ Updated Details:`);
    console.log(`   Name: ${updatedUser.firstName} ${updatedUser.lastName}`);
    console.log(`   User Type: ${updatedUser.userType}`);
    console.log(`   Linked Patient ID: ${updatedUser.linkedPatientId || 'None'}`);

    console.log(`\n✨ User fixed successfully!`);
  } catch (error) {
    console.error('❌ Fix failed:', error);
    throw error;
  }
}

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: npm run fix-user-type -- <email>');
    console.error('Example: npm run fix-user-type -- nic@test.com');
    process.exit(1);
  }

  try {
    // Fix Nic's account
    if (email === 'nic@test.com') {
      await fixUserType(email, {
        firstName: 'Nic',
        lastName: 'Munson',
        userType: 'CAREGIVER',
        linkedPatientId: null,
      });
    } else {
      console.log('For custom fixes, edit this script or provide updates');
    }
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

export { fixUserType };
