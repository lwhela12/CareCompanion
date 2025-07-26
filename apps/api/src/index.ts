import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { errorHandler } from './middleware/error';
import { logger } from './utils/logger';
import { setupRoutes } from './routes';
import { initializeJobs } from './jobs';

async function startServer() {
  const app = express();

  // Basic middleware
  app.use(helmet());
  app.use(cors({
    origin: config.frontendUrl,
    credentials: true,
  }));
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
    });
  });

  // Setup routes
  setupRoutes(app);

  // Error handling
  app.use(errorHandler);

  // Initialize background jobs
  if (config.nodeEnv !== 'test') {
    await initializeJobs();
  }

  const server = app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });

  return app;
}

startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});