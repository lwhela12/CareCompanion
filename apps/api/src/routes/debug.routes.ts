import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '@carecompanion/database';
import { AuthRequest } from '../types';

const router = Router();

// DEV ONLY: Trigger EOD conversation logging (no auth)
router.post('/api/v1/debug/trigger-eod-logging', async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not available in production' } });
      return;
    }

    const { conversationLoggingQueue } = await import('../jobs/queues');
    const job = await conversationLoggingQueue.add('eod-log-all', { type: 'eod-log-all' });

    res.json({ success: true, message: 'EOD logging job queued', jobId: job.id });
  } catch (error) {
    next(error);
  }
});

// Debug endpoint to check auth
router.get('/api/v1/debug/auth', authenticate, (req, res) => {
  res.json({
    auth: req.auth,
    headers: {
      authorization: req.headers.authorization,
    },
    user: req.user || null,
  });
});

// Test medication log endpoint
router.post('/api/v1/debug/medication-log', authenticate, async (req: AuthRequest, res) => {
  try {
    const { medicationId, scheduledTime } = req.body;
    const userId = req.auth!.userId;
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });
    
    // Check if medication exists
    const medication = await prisma.medication.findUnique({
      where: { id: medicationId },
    });
    
    // Check for existing log
    const existingLog = await prisma.medicationLog.findFirst({
      where: {
        medicationId,
        scheduledTime: new Date(scheduledTime),
      },
    });
    
    res.json({
      userId,
      userFound: !!user,
      userDbId: user?.id,
      medicationFound: !!medication,
      existingLog: !!existingLog,
      existingLogDetails: existingLog,
      scheduledTime,
      parsedTime: new Date(scheduledTime).toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

export default router;