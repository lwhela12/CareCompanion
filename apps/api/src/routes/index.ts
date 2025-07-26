import { Express } from 'express';
import { authenticate } from '../middleware/auth';
import familyRoutes from './family.routes';
import medicationRoutes from './medication.routes';
import debugRoutes from './debug.routes';

export function setupRoutes(app: Express) {
  // Debug routes (temporary)
  app.use(debugRoutes);
  
  // Family routes (includes invitation routes)
  app.use('/api/v1', familyRoutes);
  
  // Medication routes
  app.use('/api/v1', medicationRoutes);

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