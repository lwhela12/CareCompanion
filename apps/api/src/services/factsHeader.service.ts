import { prisma } from '@carecompanion/database';

export async function buildFactsHeader(familyId: string) {
  // Small, durable slice of facts for always-on context
  const pinned = await prisma.fact.findMany({
    where: { familyId, status: 'ACTIVE', pinned: true },
    include: { entity: true, sources: true },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });

  const header: any = {
    meta: {
      familyId,
      generatedAt: new Date().toISOString(),
    },
    facts: pinned.map((f) => ({
      id: f.id,
      domain: f.domain,
      entity: { id: f.entityId, type: f.entityType, name: f.entity?.displayName },
      key: f.key,
      value: f.value,
      effective: { start: f.effectiveStart, end: f.effectiveEnd },
      sources: f.sources?.map((s) => ({
        type: s.sourceType,
        id: s.sourceId,
        section: s.section || undefined,
      })),
    })),
  };

  return header;
}

