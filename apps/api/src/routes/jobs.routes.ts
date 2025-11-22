import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { getJobStatus, getFailedJobs, retryJob } from '../controllers/jobs.controller';

const router = Router();

/**
 * Job monitoring routes
 * Only accessible to authenticated users (for now, could be admin-only in future)
 */

// Get overall job status
router.get('/jobs/status', authenticate, getJobStatus);

// Get failed jobs for debugging
router.get('/jobs/failed', authenticate, getFailedJobs);

// Retry a failed job
router.post('/jobs/:queueName/:jobId/retry', authenticate, retryJob);

export default router;
