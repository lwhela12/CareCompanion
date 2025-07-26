import { Router } from 'express';

const router = Router();

// TODO: Implement medication routes
router.get('/', (req, res) => {
  res.json({ message: 'Medication routes not yet implemented' });
});

export default router;