import { Express } from 'express';
import { authenticate } from '../middleware/auth';
import familyRoutes from './family.routes';
import medicationRoutes from './medication.routes';
import { journalRoutes } from './journal.routes';
import { careTaskRoutes } from './careTask.routes';
import documentRoutes from './document.routes';
import patientRoutes from './patient.routes';
import authRoutes from './auth';
import debugRoutes from './debug.routes';
import factRoutes from './fact.routes';
import aiRoutes from './ai';
import recommendationRoutes from './recommendation.routes';
import providerRoutes from './provider.routes';
import nutritionRoutes from './nutrition.routes';
import calendarRoutes from './calendar.routes';

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

  // Document routes
  app.use('/api/v1', documentRoutes);

  // Patient routes (patient portal)
  app.use('/api/v1', patientRoutes);

  // Auth routes (impersonation, password reset)
  app.use('/api/v1/auth', authRoutes);

  // Fact review routes
  app.use('/api/v1', factRoutes);

  // AI routes
  app.use('/api/v1/ai', aiRoutes);

  // Recommendation routes
  app.use('/api/v1', recommendationRoutes);

  // Provider routes
  app.use('/api/v1', providerRoutes);

  // Nutrition routes
  app.use('/api/v1', nutritionRoutes);

  // Calendar integration routes
  app.use('/api/v1/calendar', calendarRoutes);

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
