import { prisma } from '@carecompanion/database';

/**
 * Script to clean up orphaned user records
 * Use this when a user is deleted from Clerk but still exists in the database
 */

async function cleanupUser(email: string) {
  console.log(`🧹 Cleaning up user: ${email}`);

  try {
    // Find the user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        familyMembers: true,
        linkedPatient: true,
      },
    });

    if (!user) {
      console.log(`❌ No user found with email: ${email}`);
      return;
    }

    console.log(`✅ Found user: ${user.firstName} ${user.lastName}`);
    console.log(`   User Type: ${user.userType}`);
    console.log(`   Clerk ID: ${user.clerkId}`);
    console.log(`   Family Members: ${user.familyMembers.length}`);
    console.log(`   Linked Patient: ${user.linkedPatientId ? 'Yes' : 'No'}`);

    // Delete all related records in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete audit logs
      const deletedAuditLogs = await tx.auditLog.deleteMany({
        where: { userId: user.id },
      });
      console.log(`   Deleted ${deletedAuditLogs.count} audit log(s)`);

      // Delete care task logs
      const deletedCareTaskLogs = await tx.careTaskLog.deleteMany({
        where: { userId: user.id },
      });
      console.log(`   Deleted ${deletedCareTaskLogs.count} care task log(s)`);

      // Delete medication logs (given by this user)
      const deletedMedicationLogs = await tx.medicationLog.deleteMany({
        where: { givenById: user.id },
      });
      console.log(`   Deleted ${deletedMedicationLogs.count} medication log(s)`);

      // Delete checklist logs
      const deletedChecklistLogs = await tx.patientChecklistLog.deleteMany({
        where: { completedById: user.id },
      });
      console.log(`   Deleted ${deletedChecklistLogs.count} checklist log(s)`);

      // Delete family members (these have cascade, but being explicit)
      const deletedFamilyMembers = await tx.familyMember.deleteMany({
        where: { userId: user.id },
      });
      console.log(`   Deleted ${deletedFamilyMembers.count} family member record(s)`);

      // Finally delete the user
      await tx.user.delete({
        where: { id: user.id },
      });
    });

    console.log(`✅ User deleted successfully!`);

    // Also clean up any pending invitations for this email
    const deletedInvitations = await prisma.invitation.deleteMany({
      where: {
        email,
        status: 'pending'
      },
    });

    if (deletedInvitations.count > 0) {
      console.log(`✅ Deleted ${deletedInvitations.count} pending invitation(s)`);
    }

    console.log(`\n✨ Cleanup complete! You can now send a new invitation to ${email}`);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: npm run cleanup-user -- <email>');
    console.error('Example: npm run cleanup-user -- sue@test.com');
    process.exit(1);
  }

  try {
    await cleanupUser(email);
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

export { cleanupUser };
