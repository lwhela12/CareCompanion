import 'express-async-errors';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { clerkMiddleware } from '@clerk/express';
import { config } from './config';
import { errorHandler } from './middleware/error';
import { globalRateLimiter } from './middleware/rateLimit';
import { logger } from './utils/logger';
import { performHealthChecks } from './utils/healthChecks';
import { setupRoutes } from './routes';
import { setupSwagger } from './config/swagger';
import { initializeJobs, shutdownJobs } from './jobs';

async function startServer() {
  const app = express();

  // Initialize Sentry (optional - app works without it)
  const sentryDsn = process.env.SENTRY_DSN;
  const sentryEnvironment = process.env.SENTRY_ENVIRONMENT || config.nodeEnv;

  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: sentryEnvironment,
      integrations: [
        nodeProfilingIntegration(),
      ],
      // Performance Monitoring
      tracesSampleRate: sentryEnvironment === 'production' ? 0.1 : 1.0,
      // Profiling
      profilesSampleRate: sentryEnvironment === 'production' ? 0.1 : 1.0,
      // Release tracking
      release: process.env.APP_VERSION,
      // Don't send errors in development unless explicitly enabled
      enabled: sentryEnvironment === 'production' || process.env.SENTRY_ENABLED === 'true',
    });
    logger.info('Sentry initialized for environment:', { environment: sentryEnvironment });
  }

  // Sentry request handler must be the first middleware
  app.use(Sentry.Handlers.requestHandler());
  // Sentry tracing middleware for performance monitoring
  app.use(Sentry.Handlers.tracingHandler());

  // Basic middleware
  app.use(compression()); // Enable gzip compression for responses
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

  // Apply global rate limiting
  app.use(globalRateLimiter);

  // Health check with service connectivity verification
  app.get('/health', async (req, res) => {
    try {
      const healthStatus = await performHealthChecks();

      // Return 200 for healthy/degraded, 503 for unhealthy
      const statusCode = healthStatus.status === 'unhealthy' ? 503 : 200;

      res.status(statusCode).json(healthStatus);
    } catch (error) {
      logger.error('Health check failed', { error });

      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv,
        error: 'Health check failed to execute',
      });
    }
  });

  // Setup API documentation
  setupSwagger(app);

  // Setup routes
  setupRoutes(app);

  // Sentry error handler must be before other error handlers
  app.use(Sentry.Handlers.errorHandler());

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
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');

    // Shutdown jobs first
    if (config.nodeEnv !== 'test') {
      await shutdownJobs();
    }

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