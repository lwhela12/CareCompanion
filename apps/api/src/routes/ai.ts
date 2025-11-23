import { Router } from 'express';
import { prisma } from '@carecompanion/database';
import { buildFactsHeader } from '../services/factsHeader.service';
import { aiRateLimiter } from '../middleware/rateLimit';
import { conversationService } from '../services/conversation.service';
import { chatAIService } from '../services/chatAI.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Build enhanced context including:
 * - Facts header (patient info, conditions, etc.)
 * - Active medications
 * - Recent care tasks
 * - Recent journal entries
 * - Recent recommendations
 * - Relevant documents
 */
async function buildEnhancedContext(familyId: string, query: string) {
  const contextParts: string[] = [];

  // 1. Facts header (patient demographics, conditions, etc.)
  const header = await buildFactsHeader(familyId);
  contextParts.push('# Patient & Family Facts');
  contextParts.push(JSON.stringify(header, null, 2));

  // 2. Active medications
  const medications = await prisma.medication.findMany({
    where: {
      patient: { familyId },
      isActive: true,
    },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      prescribingProvider: { select: { name: true, specialty: true } },
    },
    take: 20,
  });

  if (medications.length > 0) {
    contextParts.push('\n# Active Medications');
    for (const med of medications) {
      contextParts.push(
        `- ${med.name} ${med.dosage} (${med.frequency}) - Schedule: ${med.scheduleTime.join(', ')}` +
        (med.instructions ? ` | Instructions: ${med.instructions}` : '') +
        (med.prescribingProvider ? ` | Prescribed by: ${med.prescribingProvider.name}` : '')
      );
    }
  }

  // 3. Recent/pending care tasks
  const careTasks = await prisma.careTask.findMany({
    where: {
      familyId,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    },
    orderBy: { dueDate: 'asc' },
    take: 15,
    include: {
      assignedTo: { select: { firstName: true, lastName: true } },
    },
  });

  if (careTasks.length > 0) {
    contextParts.push('\n# Pending Care Tasks');
    for (const task of careTasks) {
      const dueStr = task.dueDate ? ` (Due: ${task.dueDate.toISOString().split('T')[0]})` : '';
      const assignee = task.assignedTo ? ` - Assigned to: ${task.assignedTo.firstName}` : '';
      contextParts.push(`- [${task.priority}] ${task.title}${dueStr}${assignee}`);
    }
  }

  // 4. Recent recommendations
  const recommendations = await prisma.fact.findMany({
    where: { familyId, status: 'ACTIVE', domain: 'MEDICAL', key: 'recommendation' },
    orderBy: { updatedAt: 'desc' },
    take: 15,
  });

  if (recommendations.length > 0) {
    contextParts.push('\n# Medical Recommendations');
    for (const r of recommendations) {
      const txt = typeof (r.value as any)?.text === 'string' ? (r.value as any).text : JSON.stringify(r.value);
      contextParts.push(`- [fact:${r.id}] ${txt}`);
    }
  }

  // 5. Recent journal entries (non-private)
  const journals = await prisma.journalEntry.findMany({
    where: { familyId, isPrivate: false },
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: { id: true, content: true, createdAt: true },
  });

  if (journals.length > 0) {
    contextParts.push('\n# Recent Journal Entries');
    for (const j of journals) {
      const date = new Date(j.createdAt).toLocaleDateString();
      contextParts.push(`- [journal:${j.id}] (${date}) ${j.content.substring(0, 500)}${j.content.length > 500 ? '...' : ''}`);
    }
  }

  // 6. Search relevant documents based on query keywords
  const documents = await prisma.document.findMany({
    where: {
      familyId,
      parsingStatus: 'COMPLETED',
      OR: [
        { title: { contains: query.split(' ')[0], mode: 'insensitive' } },
        { description: { contains: query.split(' ')[0], mode: 'insensitive' } },
      ],
    },
    take: 5,
    select: { id: true, title: true, type: true, parsedData: true },
  });

  if (documents.length > 0) {
    contextParts.push('\n# Relevant Documents');
    for (const doc of documents) {
      contextParts.push(`- [document:${doc.id}] ${doc.title} (${doc.type})`);
      if (doc.parsedData) {
        const summary = (doc.parsedData as any)?.summary || (doc.parsedData as any)?.text;
        if (summary) {
          contextParts.push(`  Summary: ${String(summary).substring(0, 300)}...`);
        }
      }
    }
  }

  return contextParts.join('\n');
}

// Enhanced chat endpoint with conversation support and tool use
router.post('/chat', aiRateLimiter, async (req, res) => {
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
    const { query, conversationId, timezone } = req.body || {};
    if (!query || typeof query !== 'string' || !query.trim()) {
      sse({ type: 'error', message: 'Missing query' });
      res.end();
      return;
    }

    // Resolve family from auth
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
    const patient = user.familyMembers[0].family.patient;

    if (!patient) {
      sse({ type: 'error', message: 'No patient found' });
      res.end();
      return;
    }

    // Create or get conversation
    let activeConversationId = conversationId;
    if (!activeConversationId) {
      // Create a new conversation
      const newConversation = await conversationService.createConversation({
        familyId,
        userId: user.id,
      });
      activeConversationId = newConversation.id;
      sse({ type: 'conversation', conversationId: activeConversationId });
    } else {
      // Verify conversation belongs to user's family
      const existingConversation = await conversationService.getConversation(
        activeConversationId,
        familyId
      );
      if (!existingConversation) {
        sse({ type: 'error', message: 'Conversation not found' });
        res.end();
        return;
      }
    }

    // Save user message to conversation
    await conversationService.addMessage({
      conversationId: activeConversationId,
      role: 'USER',
      content: query,
    });

    // Build enhanced context
    sse({ type: 'status', status: 'building_context' });
    const contextText = await buildEnhancedContext(familyId, query);

    // Get conversation history for multi-turn memory
    const conversationHistory = await conversationService.getRecentMessagesForContext(
      activeConversationId,
      10
    );

    // Build chat context
    const patientName = `${patient.firstName} ${patient.lastName}`;
    const chatContext = {
      familyId,
      userId: user.id,
      patientId: patient.id,
      patientName,
      userName: user.firstName || 'Caregiver',
      timezone: timezone || 'America/New_York', // Default to Eastern if not provided
    };

    // Build messages for Claude (skip the last message which is the current query we just added)
    const historyWithoutCurrent = conversationHistory.slice(0, -1);
    const messages: { role: 'user' | 'assistant'; content: string }[] = historyWithoutCurrent.map((msg) => ({
      role: msg.role === 'USER' ? 'user' as const : 'assistant' as const,
      content: msg.content,
    }));
    messages.push({ role: 'user', content: query });

    // Stream response from Claude with tool support
    let fullResponse = '';
    let deltaCount = 0;
    for await (const event of chatAIService.chat(messages, chatContext, contextText)) {
      switch (event.type) {
        case 'text':
          deltaCount++;
          fullResponse += event.content || '';
          logger.debug('SSE delta sent', { deltaCount, textLength: (event.content || '').length, preview: (event.content || '').substring(0, 30) });
          sse({ type: 'delta', text: event.content });
          break;

        case 'tool_use':
          sse({ type: 'tool_use', toolName: event.toolName, input: event.toolInput });
          break;

        case 'tool_result':
          sse({ type: 'tool_result', toolName: event.toolName, result: event.toolResult });
          break;

        case 'done':
          break;

        case 'error':
          sse({ type: 'error', message: event.content });
          break;
      }
    }

    // Save assistant response to conversation
    if (fullResponse) {
      await conversationService.addMessage({
        conversationId: activeConversationId,
        role: 'ASSISTANT',
        content: fullResponse,
      });
    }

    sse({ type: 'done', conversationId: activeConversationId });
    res.end();
  } catch (e: any) {
    logger.error('AI chat error', { error: e.message, stack: e.stack });
    sse({ type: 'error', message: e?.message || 'Chat failed' });
    res.end();
  }
});

export default router;
