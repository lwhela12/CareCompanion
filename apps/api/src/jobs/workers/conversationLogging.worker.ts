import { Worker, Job } from 'bullmq';
import { prisma } from '@carecompanion/database';
import { logger } from '../../utils/logger';
import { conversationSummaryService } from '../../services/conversationSummary.service';

/**
 * Job data for conversation logging
 */
interface ConversationLoggingJobData {
  type: 'eod-log-all' | 'log-user-conversations';
  userId?: string;
  familyId?: string;
}

/**
 * End of day job to log all unlogged conversations for all users
 */
async function logAllUnloggedConversations() {
  logger.info('Starting EOD conversation logging job');

  // Get all users who have conversations today that haven't been logged
  const usersWithConversations = await prisma.conversation.findMany({
    where: {
      loggedToJournalAt: null,
      messages: { some: {} }, // Has at least one message
      updatedAt: {
        // Conversations from today
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    },
    select: {
      userId: true,
      familyId: true,
    },
    distinct: ['userId'],
  });

  logger.info(`Found ${usersWithConversations.length} users with unlogged conversations`);

  let totalLogged = 0;
  let usersProcessed = 0;

  for (const { userId, familyId } of usersWithConversations) {
    try {
      const loggedCount = await conversationSummaryService.logUnloggedConversations(
        userId,
        familyId
      );
      totalLogged += loggedCount;
      usersProcessed++;

      logger.info('Logged conversations for user', {
        userId,
        loggedCount,
      });
    } catch (error) {
      logger.error('Failed to log conversations for user', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  logger.info('EOD conversation logging job completed', {
    usersProcessed,
    totalLogged,
  });

  return { usersProcessed, totalLogged };
}

/**
 * Log conversations for a specific user (used for logout flow)
 */
async function logUserConversations(userId: string, familyId: string) {
  logger.info('Logging conversations for user on logout', { userId });

  try {
    const loggedCount = await conversationSummaryService.logUnloggedConversations(
      userId,
      familyId
    );

    logger.info('User conversations logged', {
      userId,
      loggedCount,
    });

    return { loggedCount };
  } catch (error) {
    logger.error('Failed to log user conversations', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Process conversation logging jobs
 */
async function processConversationLogging(job: Job<ConversationLoggingJobData>) {
  const { type, userId, familyId } = job.data;

  logger.info('Processing conversation logging job', {
    jobId: job.id,
    type,
  });

  switch (type) {
    case 'eod-log-all':
      return await logAllUnloggedConversations();

    case 'log-user-conversations':
      if (!userId || !familyId) {
        throw new Error('userId and familyId required for log-user-conversations');
      }
      return await logUserConversations(userId, familyId);

    default:
      throw new Error(`Unknown conversation logging job type: ${type}`);
  }
}

/**
 * Create and export the conversation logging worker
 */
export function createConversationLoggingWorker(connection: any) {
  const worker = new Worker('conversation-logging', processConversationLogging, {
    connection,
    concurrency: 3, // Process up to 3 jobs concurrently
    limiter: {
      max: 5, // Max 5 jobs
      duration: 1000, // per second
    },
  });

  worker.on('completed', (job) => {
    logger.info('Conversation logging job completed', {
      jobId: job.id,
      returnValue: job.returnvalue,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error('Conversation logging job failed', {
      jobId: job?.id,
      error: err.message,
      stack: err.stack,
    });
  });

  worker.on('error', (err) => {
    logger.error('Conversation logging worker error', {
      error: err.message,
      stack: err.stack,
    });
  });

  return worker;
}
