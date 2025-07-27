import { Router } from 'express';
import { journalController } from '../controllers/journal.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/async';
import { audioUpload } from '../middleware/upload';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Journal entry routes
router.post('/', asyncHandler(journalController.createEntry.bind(journalController)));
router.get('/', asyncHandler(journalController.getEntries.bind(journalController)));
router.get('/insights', asyncHandler(journalController.getInsights.bind(journalController)));
router.get('/:entryId', asyncHandler(journalController.getEntry.bind(journalController)));
router.put('/:entryId', asyncHandler(journalController.updateEntry.bind(journalController)));
router.delete('/:entryId', asyncHandler(journalController.deleteEntry.bind(journalController)));

// Audio transcription route
router.post('/transcribe', audioUpload.single('audio'), asyncHandler(journalController.transcribeAudio.bind(journalController)));

export { router as journalRoutes };