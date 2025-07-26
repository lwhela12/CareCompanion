import { Router } from 'express';

const router = Router();

// TODO: Implement journal routes
router.get('/', (req, res) => {
  res.json({ message: 'Journal routes not yet implemented' });
});

export default router;