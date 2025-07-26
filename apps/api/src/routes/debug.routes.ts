import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '@carecompanion/database';
import { AuthRequest } from '../types';

const router = Router();

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