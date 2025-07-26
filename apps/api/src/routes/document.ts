import { Router } from 'express';

const router = Router();

// TODO: Implement document routes
router.get('/', (req, res) => {
  res.json({ message: 'Document routes not yet implemented' });
});

export default router;