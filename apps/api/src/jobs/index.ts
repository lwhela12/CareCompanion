import { Worker } from 'bullmq';
import { logger } from '../utils/logger';
import { medicationQueue, documentQueue, closeQueues } from './queues';
import { createMedicationReminderWorker } from './workers/medicationReminder.worker';
import { createDocumentProcessingWorker } from './workers/documentProcessing.worker';
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

    workers = [medicationWorker, documentWorker];

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
 * Set up recurring jobs (medication reminders, etc.)
 */
async function setupRecurringJobs() {
  logger.info('Setting up recurring jobs...');

  // Remove any existing repeatable jobs with the same key
  const existingJobs = await medicationQueue.getRepeatableJobs();
  for (const job of existingJobs) {
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

// Export queues for job status checking
export { medicationQueue, documentQueue };
