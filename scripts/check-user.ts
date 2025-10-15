import { prisma } from '@carecompanion/database';

/**
 * Script to check user details
 */

async function checkUser(email: string) {
  console.log(`🔍 Checking user: ${email}`);

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        familyMembers: {
          include: {
            family: {
              include: {
                patient: true,
              },
            },
          },
        },
        linkedPatient: true,
      },
    });

    if (!user) {
      console.log(`❌ No user found with email: ${email}`);
      return;
    }

    console.log(`\n✅ User Found:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Clerk ID: ${user.clerkId}`);
    console.log(`   User Type: ${user.userType}`);
    console.log(`   Linked Patient ID: ${user.linkedPatientId || 'None'}`);

    if (user.linkedPatient) {
      console.log(`   Linked Patient: ${user.linkedPatient.firstName} ${user.linkedPatient.lastName}`);
    }

    console.log(`\n👥 Family Memberships: ${user.familyMembers.length}`);
    for (const fm of user.familyMembers) {
      console.log(`   - ${fm.family.name} (${fm.role}, ${fm.relationship})`);
      console.log(`     Active: ${fm.isActive}`);
      console.log(`     Patient: ${fm.family.patient?.firstName} ${fm.family.patient?.lastName}`);
    }

  } catch (error) {
    console.error('❌ Check failed:', error);
    throw error;
  }
}

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: npm run check-user -- <email>');
    console.error('Example: npm run check-user -- nic@test.com');
    process.exit(1);
  }

  try {
    await checkUser(email);
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

export { checkUser };
