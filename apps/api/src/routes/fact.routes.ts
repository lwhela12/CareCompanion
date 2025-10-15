import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/async';
import { factController } from '../controllers/fact.controller';

const router = Router();

router.use(authenticate);

router.get('/facts', asyncHandler(factController.list.bind(factController)));
router.get('/facts/:factId', asyncHandler(factController.get.bind(factController)));
router.patch('/facts/:factId', asyncHandler(factController.patch.bind(factController)));
router.post('/facts', asyncHandler(factController.create.bind(factController)));
router.get('/facts/header', asyncHandler(factController.header.bind(factController)));

export default router;
