import { Router } from 'express';
import OpenAI from 'openai';
import { prisma } from '@carecompanion/database';
import { config } from '../config';
import { buildFactsHeader } from '../services/factsHeader.service';

const router = Router();

// Simple chat endpoint (SSE) using small context: Facts Header + recent journals + recent recommendations
router.post('/chat', async (req, res) => {
  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sse = (payload: any) => {
    try { res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch {}
  };

  try {
    // Input
    const { query } = req.body || {};
    if (!query || typeof query !== 'string' || !query.trim()) {
      sse({ type: 'error', message: 'Missing query' });
      res.end();
      return;
    }

    // Resolve family from auth (Clerk attaches req.auth via middleware in index.ts)
    const auth: any = (req as any).auth;
    if (!auth?.userId) {
      sse({ type: 'error', message: 'Unauthorized' });
      res.end();
      return;
    }
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      include: { familyMembers: { where: { isActive: true }, include: { family: { include: { patient: true } } } } },
    });
    if (!user || user.familyMembers.length === 0) {
      sse({ type: 'error', message: 'No family found' });
      res.end();
      return;
    }
    const familyId = user.familyMembers[0].familyId;

    // Build small context
    sse({ type: 'status', status: 'building_context' });
    const header = await buildFactsHeader(familyId);

    const journals = await prisma.journalEntry.findMany({
      where: { familyId, isPrivate: false },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, content: true, createdAt: true },
    });

    const recFacts = await prisma.fact.findMany({
      where: { familyId, status: 'ACTIVE', domain: 'MEDICAL', key: 'recommendation' },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    const contextParts: string[] = [];
    contextParts.push('# Facts Header');
    contextParts.push(JSON.stringify(header));
    if (recFacts.length > 0) {
      contextParts.push('\n# Recent Recommendations');
      for (const r of recFacts) {
        const txt = typeof (r.value as any)?.text === 'string' ? (r.value as any).text : JSON.stringify(r.value);
        contextParts.push(`- [fact:${r.id}] ${txt}`);
      }
    }
    if (journals.length > 0) {
      contextParts.push('\n# Recent Journal Entries');
      for (const j of journals) {
        contextParts.push(`- [journal:${j.id}] (${new Date(j.createdAt).toISOString()}) ${j.content}`);
      }
    }

    const contextText = contextParts.join('\n');

    // OpenAI stream
    if (!config.openaiApiKey) {
      sse({ type: 'error', message: 'OpenAI not configured' });
      res.end();
      return;
    }
    const openai = new OpenAI({ apiKey: config.openaiApiKey });

    const system = `You are a careful family care assistant.
Answer strictly from the provided context sections and include citations using anchors exactly as [journal:ID], [fact:ID], or [document:ID].
Do not invent facts. Do not repeat words or phrases (no stuttering). Write each sentence once, clearly and concisely.`;
    const userMsg = `Context:\n${contextText}\n\nQuestion: ${query}\n\nInstructions: Answer concisely with citations in-line using the provided anchors. If insufficient context, say so and suggest what to look up.`;

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      stream: true,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMsg },
      ],
    });

    let full = '';
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        full += delta;
        sse({ type: 'delta', text: delta });
      }
    }
    sse({ type: 'done' });
    res.end();
  } catch (e: any) {
    sse({ type: 'error', message: e?.message || 'Chat failed' });
    res.end();
  }
});

export default router;
