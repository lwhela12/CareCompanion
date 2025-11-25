import { Queue, QueueOptions } from 'bullmq';
import { config } from '../config';
import { logger } from '../utils/logger';

// Parse Redis URL to extract connection details
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

// Common queue options
const queueOptions: QueueOptions = {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      count: 200, // Keep last 200 failed jobs for debugging
    },
  },
};

// Define queue names
export const QUEUE_NAMES = {
  MEDICATION_REMINDERS: 'medication-reminders',
  DOCUMENT_PROCESSING: 'document-processing',
  SUMMARY_GENERATION: 'summary-generation',
  PATTERN_DETECTION: 'pattern-detection',
  CONVERSATION_LOGGING: 'conversation-logging',
} as const;

// Create queues
export const medicationQueue = new Queue(QUEUE_NAMES.MEDICATION_REMINDERS, queueOptions);
export const documentQueue = new Queue(QUEUE_NAMES.DOCUMENT_PROCESSING, queueOptions);
export const summaryQueue = new Queue(QUEUE_NAMES.SUMMARY_GENERATION, queueOptions);
export const patternQueue = new Queue(QUEUE_NAMES.PATTERN_DETECTION, queueOptions);
export const conversationLoggingQueue = new Queue(QUEUE_NAMES.CONVERSATION_LOGGING, queueOptions);

// Graceful shutdown
export async function closeQueues() {
  logger.info('Closing job queues...');
  await Promise.all([
    medicationQueue.close(),
    documentQueue.close(),
    summaryQueue.close(),
    patternQueue.close(),
    conversationLoggingQueue.close(),
  ]);
  logger.info('All queues closed');
}
