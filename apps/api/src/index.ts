import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { clerkMiddleware } from '@clerk/express';
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
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      // List of allowed origins (strings and regex patterns)
      const allowedOrigins = [
        config.frontendUrl, // Primary frontend URL
        'http://localhost:5173', // Local development
        'http://localhost:3000', // Alternative local port
        /^https:\/\/care-companion-.*\.vercel\.app$/, // All Vercel preview deployments
        ...config.allowedOrigins, // Additional origins from env var
      ];

      // Check if the origin matches any allowed pattern
      const isAllowed = allowedOrigins.some(allowed => {
        if (typeof allowed === 'string') return allowed === origin;
        if (allowed instanceof RegExp) return allowed.test(origin);
        return false;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }));
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Add Clerk middleware before routes
  app.use(clerkMiddleware({
    secretKey: config.clerk.secretKey,
  }));

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