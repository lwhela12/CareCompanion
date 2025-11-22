import { Request, Response } from 'express';
import { medicationQueue, documentQueue } from '../jobs';
import { logger } from '../utils/logger';

/**
 * Get job queue status and statistics
 */
export async function getJobStatus(req: Request, res: Response) {
  try {
    const [
      medicationCounts,
      documentCounts,
      medicationJobs,
      documentJobs,
      medicationRepeatable,
    ] = await Promise.all([
      medicationQueue.getJobCounts(),
      documentQueue.getJobCounts(),
      medicationQueue.getJobs(['active', 'waiting', 'delayed'], 0, 10),
      documentQueue.getJobs(['active', 'waiting', 'delayed'], 0, 10),
      medicationQueue.getRepeatableJobs(),
    ]);

    res.json({
      queues: {
        medication: {
          counts: medicationCounts,
          recentJobs: await Promise.all(
            medicationJobs.map(async (job) => ({
              id: job.id,
              name: job.name,
              data: job.data,
              timestamp: job.timestamp,
              processedOn: job.processedOn,
              finishedOn: job.finishedOn,
              attemptsMade: job.attemptsMade,
              state: await job.getState(),
            }))
          ),
          repeatableJobs: medicationRepeatable.map((job) => ({
            key: job.key,
            name: job.name,
            pattern: job.pattern,
            next: job.next,
          })),
        },
        document: {
          counts: documentCounts,
          recentJobs: await Promise.all(
            documentJobs.map(async (job) => ({
              id: job.id,
              name: job.name,
              data: {
                documentId: job.data.documentId,
                familyId: job.data.familyId,
              },
              timestamp: job.timestamp,
              processedOn: job.processedOn,
              finishedOn: job.finishedOn,
              attemptsMade: job.attemptsMade,
              state: await job.getState(),
            }))
          ),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching job status', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      error: {
        code: 'JOB_STATUS_ERROR',
        message: 'Failed to fetch job status',
      },
    });
  }
}

/**
 * Get failed jobs for debugging
 */
export async function getFailedJobs(req: Request, res: Response) {
  try {
    const [medicationFailed, documentFailed] = await Promise.all([
      medicationQueue.getJobs(['failed'], 0, 50),
      documentQueue.getJobs(['failed'], 0, 50),
    ]);

    const medicationFailedDetails = await Promise.all(
      medicationFailed.map(async (job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        timestamp: job.timestamp,
        failedReason: job.failedReason,
        stacktrace: job.stacktrace,
        attemptsMade: job.attemptsMade,
      }))
    );

    const documentFailedDetails = await Promise.all(
      documentFailed.map(async (job) => ({
        id: job.id,
        name: job.name,
        data: {
          documentId: job.data.documentId,
          familyId: job.data.familyId,
        },
        timestamp: job.timestamp,
        failedReason: job.failedReason,
        stacktrace: job.stacktrace?.slice(0, 500), // Truncate stacktrace
        attemptsMade: job.attemptsMade,
      }))
    );

    res.json({
      medication: medicationFailedDetails,
      document: documentFailedDetails,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching failed jobs', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      error: {
        code: 'FAILED_JOBS_ERROR',
        message: 'Failed to fetch failed jobs',
      },
    });
  }
}

/**
 * Retry a failed job by ID
 */
export async function retryJob(req: Request, res: Response) {
  const { queueName, jobId } = req.params;

  try {
    const queue = queueName === 'medication' ? medicationQueue : documentQueue;
    const job = await queue.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        error: {
          code: 'JOB_NOT_FOUND',
          message: `Job ${jobId} not found in ${queueName} queue`,
        },
      });
    }

    await job.retry();

    logger.info('Job retried', { queueName, jobId });

    return res.json({
      success: true,
      jobId,
      queueName,
      message: 'Job queued for retry',
    });
  } catch (error) {
    logger.error('Error retrying job', {
      queueName,
      jobId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return res.status(500).json({
      error: {
        code: 'JOB_RETRY_ERROR',
        message: 'Failed to retry job',
      },
    });
  }
}
