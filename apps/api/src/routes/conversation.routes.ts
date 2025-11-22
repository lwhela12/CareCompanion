import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { conversationService } from '../services/conversation.service';
import { z } from 'zod';
import { validate } from '../middleware/validate';

const router = Router();

// All routes require authentication
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
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
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
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
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
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
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
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
    }

    res.json({ message: 'Conversation deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
