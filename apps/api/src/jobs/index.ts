import { Worker } from 'bullmq';
import { logger } from '../utils/logger';
import { medicationQueue, documentQueue, conversationLoggingQueue, closeQueues } from './queues';
import { createMedicationReminderWorker } from './workers/medicationReminder.worker';
import { createDocumentProcessingWorker } from './workers/documentProcessing.worker';
import { createConversationLoggingWorker } from './workers/conversationLogging.worker';
import { config } from '../config';

// Store workers for cleanup
let workers: Worker[] = [];

/**
 * Get Redis connection config from the config module
 */
function getRedisConnection() {
  const redisUrl = config.redisUrl;

  try {
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.password || undefined,
      username: url.username || undefined,
    };
  } catch (error) {
    logger.error('Failed to parse Redis URL, falling back to defaults', { error });
    return {
      host: 'localhost',
      port: 6379,
    };
  }
}

/**
 * Initialize all background job queues and workers
 */
export async function initializeJobs() {
  logger.info('Initializing background jobs...');

  try {
    const connection = getRedisConnection();

    // Create workers
    const medicationWorker = createMedicationReminderWorker(connection);
    const documentWorker = createDocumentProcessingWorker(connection);
    const conversationWorker = createConversationLoggingWorker(connection);

    workers = [medicationWorker, documentWorker, conversationWorker];

    logger.info('Job workers created', {
      workers: workers.map((w) => w.name),
    });

    // Set up recurring job for medication reminders (every 15 minutes)
    await setupRecurringJobs();

    logger.info('Background jobs initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize background jobs', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Set up recurring jobs (medication reminders, conversation logging, etc.)
 */
async function setupRecurringJobs() {
  logger.info('Setting up recurring jobs...');

  // Remove any existing repeatable jobs with the same key
  const existingMedJobs = await medicationQueue.getRepeatableJobs();
  for (const job of existingMedJobs) {
    if (job.key === 'medication-reminder-check') {
      await medicationQueue.removeRepeatableByKey(job.key);
      logger.info('Removed existing medication reminder job');
    }
  }

  // Add medication reminder check every 15 minutes
  await medicationQueue.add(
    'check-upcoming',
    { type: 'check-upcoming' },
    {
      repeat: {
        pattern: '*/15 * * * *', // Every 15 minutes
      },
      jobId: 'medication-reminder-check',
    }
  );

  logger.info('Recurring medication reminder job scheduled (every 15 minutes)');

  // Remove any existing conversation logging jobs
  const existingConvJobs = await conversationLoggingQueue.getRepeatableJobs();
  for (const job of existingConvJobs) {
    if (job.key === 'eod-conversation-logging') {
      await conversationLoggingQueue.removeRepeatableByKey(job.key);
      logger.info('Removed existing conversation logging job');
    }
  }

  // Add EOD conversation logging job - runs at 11:00 PM every day
  // This gives users time to log out naturally before the automatic sweep
  await conversationLoggingQueue.add(
    'eod-log-all',
    { type: 'eod-log-all' },
    {
      repeat: {
        pattern: '0 23 * * *', // 11:00 PM daily
      },
      jobId: 'eod-conversation-logging',
    }
  );

  logger.info('Recurring conversation logging job scheduled (daily at 11:00 PM)');
}

/**
 * Gracefully shutdown all workers and queues
 */
export async function shutdownJobs() {
  logger.info('Shutting down background jobs...');

  try {
    // Close all workers
    await Promise.all(workers.map((worker) => worker.close()));
    logger.info('All workers closed');

    // Close all queues
    await closeQueues();

    logger.info('Background jobs shut down successfully');
  } catch (error) {
    logger.error('Error during background jobs shutdown', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Queue a document for processing
 * This is called by the document upload controller
 */
export async function queueDocumentProcessing(data: {
  documentId: string;
  familyId: string;
  userId: string;
  fileUrl: string;
  fileType: string;
}) {
  logger.info('Queueing document for processing', {
    documentId: data.documentId,
  });

  const job = await documentQueue.add('process-document', data, {
    attempts: 2, // Fewer retries for document processing (AI calls are expensive)
    backoff: {
      type: 'exponential',
      delay: 5000, // Start with 5 second delay
    },
  });

  logger.info('Document processing job queued', {
    jobId: job.id,
    documentId: data.documentId,
  });

  return job.id;
}

/**
 * Queue a user's conversations for logging (for logout flow)
 * This can be called synchronously before logout completes
 */
export async function queueUserConversationLogging(data: {
  userId: string;
  familyId: string;
}) {
  logger.info('Queueing user conversation logging', {
    userId: data.userId,
  });

  const job = await conversationLoggingQueue.add(
    'log-user-conversations',
    {
      type: 'log-user-conversations',
      ...data,
    },
    {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
    }
  );

  logger.info('User conversation logging job queued', {
    jobId: job.id,
    userId: data.userId,
  });

  return job.id;
}

// Export queues for job status checking
export { medicationQueue, documentQueue, conversationLoggingQueue };
