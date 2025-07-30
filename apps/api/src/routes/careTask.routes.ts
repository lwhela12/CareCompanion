import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { careTaskController } from '../controllers/careTask.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Care task routes
router.post('/', async (req, res, next) => {
  try {
    await careTaskController.createTask(req, res);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    await careTaskController.getTasks(req, res);
  } catch (error) {
    next(error);
  }
});

router.get('/:taskId', async (req, res, next) => {
  try {
    await careTaskController.getTask(req, res);
  } catch (error) {
    next(error);
  }
});

router.put('/:taskId', async (req, res, next) => {
  try {
    await careTaskController.updateTask(req, res);
  } catch (error) {
    next(error);
  }
});

router.put('/:taskId/series', async (req, res, next) => {
  try {
    await careTaskController.updateSeries(req, res);
  } catch (error) {
    next(error);
  }
});

router.delete('/:taskId', async (req, res, next) => {
  try {
    await careTaskController.deleteTask(req, res);
  } catch (error) {
    next(error);
  }
});

router.post('/:taskId/complete', async (req, res, next) => {
  try {
    await careTaskController.completeTask(req, res);
  } catch (error) {
    next(error);
  }
});

router.post('/:taskId/materialize', async (req, res, next) => {
  try {
    await careTaskController.materializeTask(req, res);
  } catch (error) {
    next(error);
  }
});

export { router as careTaskRoutes };