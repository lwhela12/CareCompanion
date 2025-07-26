import { Router } from 'express';

const router = Router();

// TODO: Implement care task routes
router.get('/', (req, res) => {
  res.json({ message: 'Care task routes not yet implemented' });
});

export default router;