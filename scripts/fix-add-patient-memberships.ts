#!/usr/bin/env tsx
import { prisma } from '@carecompanion/database';

async function main() {
  console.log('🔧 Ensuring patient users are members of their family...');
  const patients = await prisma.patient.findMany({ include: { family: true, user: true } });

  let created = 0;
  for (const p of patients) {
    if (!p.user) continue;
    const existing = await prisma.familyMember.findFirst({ where: { userId: p.user.id, familyId: p.familyId } });
    if (!existing) {
      await prisma.familyMember.create({
        data: {
          userId: p.user.id,
          familyId: p.familyId,
          role: 'read_only',
          relationship: 'patient',
          isActive: true,
        }
      });
      created++;
      console.log(`✅ Linked patient user ${p.user.firstName} ${p.user.lastName} to family ${p.familyId}`);
    }
  }
  console.log(`Done. Created ${created} missing memberships.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
