import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { conversationService } from '../services/conversation.service';
import { conversationSummaryService } from '../services/conversationSummary.service';
import { z } from 'zod';
import { validate } from '../middleware/validate';

const router = Router();

// DEV ONLY: Manually trigger EOD conversation logging for testing (no auth required)
router.post('/trigger-eod-logging', async (req, res, next) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Not available in production' },
      });
      return;
    }

    // Import and queue the EOD job
    const { conversationLoggingQueue } = await import('../jobs/queues');
    const job = await conversationLoggingQueue.add('eod-log-all', { type: 'eod-log-all' });

    res.json({
      success: true,
      message: 'EOD logging job queued',
      jobId: job.id,
    });
  } catch (error) {
    next(error);
  }
});

// All routes below require authentication
router.use(authenticate);

// Create a new conversation
const createConversationSchema = z.object({
  title: z.string().max(100).optional(),
});

router.post('/', validate(createConversationSchema), async (req, res, next) => {
  try {
    const { title } = req.body;
    const conversation = await conversationService.createConversation({
      familyId: req.user!.familyId,
      userId: req.user!.id,
      title,
    });
    res.status(201).json({ conversation });
  } catch (error) {
    next(error);
  }
});

// List user's conversations
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    const conversations = await conversationService.listConversations({
      familyId: req.user!.familyId,
      userId: req.user!.id,
      limit,
      offset,
    });

    res.json({ conversations });
  } catch (error) {
    next(error);
  }
});

// Get a specific conversation with messages
router.get('/:id', async (req, res, next) => {
  try {
    const conversation = await conversationService.getConversation(
      req.params.id,
      req.user!.familyId
    );

    if (!conversation) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
      return;
    }

    res.json({ conversation });
  } catch (error) {
    next(error);
  }
});

// Get messages from a conversation (with pagination)
router.get('/:id/messages', async (req, res, next) => {
  try {
    // First verify the conversation belongs to the user's family
    const conversation = await conversationService.getConversation(
      req.params.id,
      req.user!.familyId
    );

    if (!conversation) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const beforeId = req.query.beforeId as string | undefined;

    const messages = await conversationService.getMessages({
      conversationId: req.params.id,
      limit,
      beforeId,
    });

    res.json({ messages });
  } catch (error) {
    next(error);
  }
});

// Update conversation title
const updateTitleSchema = z.object({
  title: z.string().min(1).max(100),
});

router.patch('/:id', validate(updateTitleSchema), async (req, res, next) => {
  try {
    const { title } = req.body;
    const conversation = await conversationService.updateTitle(
      req.params.id,
      req.user!.familyId,
      title
    );

    if (!conversation) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
      return;
    }

    res.json({ conversation });
  } catch (error) {
    next(error);
  }
});

// Delete a conversation
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await conversationService.deleteConversation(
      req.params.id,
      req.user!.familyId
    );

    if (!result) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
      return;
    }

    res.json({ message: 'Conversation deleted' });
  } catch (error) {
    next(error);
  }
});

// Log a conversation to the journal
router.post('/:id/log-to-journal', async (req, res, next) => {
  try {
    // First verify the conversation belongs to the user
    const conversation = await conversationService.getConversation(
      req.params.id,
      req.user!.familyId
    );

    if (!conversation) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
      return;
    }

    const result = await conversationSummaryService.logToJournal(
      req.params.id,
      req.user!.id,
      req.user!.familyId
    );

    if (!result.success) {
      res.status(400).json({
        error: { code: 'LOG_FAILED', message: result.message },
      });
      return;
    }

    res.json({
      success: true,
      journalEntryId: result.journalEntryId,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
});

// Log all unlogged conversations for the current user (for logout flow)
router.post('/log-all-to-journal', async (req, res, next) => {
  try {
    const loggedCount = await conversationSummaryService.logUnloggedConversations(
      req.user!.id,
      req.user!.familyId
    );

    res.json({
      success: true,
      loggedCount,
      message: `Logged ${loggedCount} conversation(s) to journal`,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
