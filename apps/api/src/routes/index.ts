import { Express } from 'express';
import { authenticate, loadUser } from '../middleware/auth';
import authRoutes from './auth';
import familyRoutes from './family';
import patientRoutes from './patient';
import journalRoutes from './journal';
import medicationRoutes from './medication';
import careTaskRoutes from './careTask';
import documentRoutes from './document';
import aiRoutes from './ai';

export function setupRoutes(app: Express) {
  // Public routes
  app.use('/api/v1/auth', authRoutes);

  // Protected routes - require authentication
  app.use('/api/v1/families', authenticate, loadUser, familyRoutes);
  app.use('/api/v1/patients', authenticate, loadUser, patientRoutes);
  app.use('/api/v1/journal-entries', authenticate, loadUser, journalRoutes);
  app.use('/api/v1/medications', authenticate, loadUser, medicationRoutes);
  app.use('/api/v1/medication-logs', authenticate, loadUser, medicationRoutes);
  app.use('/api/v1/care-tasks', authenticate, loadUser, careTaskRoutes);
  app.use('/api/v1/documents', authenticate, loadUser, documentRoutes);
  app.use('/api/v1/ai', authenticate, loadUser, aiRoutes);

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