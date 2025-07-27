import { Express } from 'express';
import { authenticate } from '../middleware/auth';
import familyRoutes from './family.routes';
import medicationRoutes from './medication.routes';
import { journalRoutes } from './journal.routes';
import { careTaskRoutes } from './careTask.routes';
import debugRoutes from './debug.routes';

export function setupRoutes(app: Express) {
  // Debug routes (temporary)
  app.use(debugRoutes);
  
  // Family routes (includes invitation routes)
  app.use('/api/v1', familyRoutes);
  
  // Medication routes
  app.use('/api/v1', medicationRoutes);
  
  // Journal routes
  app.use('/api/v1/journal', journalRoutes);
  
  // Care task routes
  app.use('/api/v1/care-tasks', careTaskRoutes);

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