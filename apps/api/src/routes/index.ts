import { Express } from 'express';
import { authenticate } from '../middleware/auth';
import familyRoutes from './family.routes';

export function setupRoutes(app: Express) {
  // Family routes (includes invitation routes)
  app.use('/api/v1', familyRoutes);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    });
  });
}