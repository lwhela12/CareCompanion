import { prisma } from '@carecompanion/database';

type Parsed = any; // we trust shape loosely; validated upstream

export async function extractFactsFromParsedDocument(documentId: string) {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return;

  const familyId = doc.familyId;
  const parsed = (doc as any).parsedData as Parsed;
  if (!parsed) return;

  // Helper: upsert entity by (familyId, type, displayName)
  const upsertEntity = async (type: string, displayName: string | null | undefined, metadata?: any) => {
    const name = (displayName || '').trim();
    const e = await prisma.factEntity.findFirst({ where: { familyId, type, displayName: name } });
    if (e) return e;
    return prisma.factEntity.create({ data: { familyId, type, displayName: name || undefined, metadata } });
  };

  const createFact = async (entityId: string, domain: string, entityType: string, key: string, value: any, section?: string) => {
    const fact = await prisma.fact.create({
      data: {
        familyId,
        entityId,
        domain: domain as any,
        entityType,
        key,
        value,
        status: 'PROPOSED',
        assertedBy: 'AI',
        confidence: 0.6,
        pinned: false,
      },
    });
    await prisma.factSource.create({
      data: {
        factId: fact.id,
        sourceType: 'document',
        sourceId: documentId,
        section,
      },
    });
  };

  // Patient entity (single patient per family)
  const patientEntity = await upsertEntity('patient', undefined);

  // Providers
  const providerName = parsed?.visit?.provider?.name as string | undefined;
  if (providerName) {
    const providerEntity = await upsertEntity('provider', providerName, parsed?.visit?.provider || undefined);
    await createFact(providerEntity.id, 'MEDICAL', 'provider', 'provider.info', parsed?.visit?.provider || { name: providerName }, 'provider');
  }

  // Diagnoses
  const diagnoses = Array.isArray(parsed?.diagnoses) ? parsed.diagnoses : [];
  for (const d of diagnoses) {
    if (!d?.name) continue;
    const entity = await upsertEntity('condition', d.name);
    await createFact(entity.id, 'MEDICAL', 'diagnosis', 'diagnosis', { name: d.name, icd10: d.icd10 ?? null }, 'diagnoses');
  }

  // Medications
  const meds = Array.isArray(parsed?.medications) ? parsed.medications : [];
  for (const m of meds) {
    if (!m?.name) continue;
    const entity = await upsertEntity('medication', m.name);
    await createFact(entity.id, 'MEDICAL', 'medication', 'medication', {
      name: m.name,
      dosage: m.dosage ?? null,
      frequency: m.frequency ?? null,
      route: m.route ?? null,
      status: m.status ?? null,
      notes: m.notes ?? null,
    }, 'medications');
  }

  // Recommendations (attach to patient entity)
  const recs = Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];
  for (const r of recs) {
    await createFact(patientEntity.id, 'MEDICAL', 'patient', 'recommendation', { text: r }, 'recommendations');
  }
}

