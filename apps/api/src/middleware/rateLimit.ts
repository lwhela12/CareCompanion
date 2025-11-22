import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';

// Create Redis client for rate limiting (separate from BullMQ)
let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedisClient() {
  if (!redisClient && config.redisUrl && config.nodeEnv === 'production') {
    try {
      redisClient = createClient({
        url: config.redisUrl,
      });

      redisClient.on('error', (err) => {
        logger.error('Rate limit Redis client error', { error: err });
      });

      await redisClient.connect();
      logger.info('Rate limit Redis client connected');
    } catch (error) {
      logger.error('Failed to connect rate limit Redis client', { error });
      // Fall back to memory store
      redisClient = null;
    }
  }

  return redisClient;
}

// Standard rate limit handler
const rateLimitHandler = (req: any, res: any) => {
  logger.warn('Rate limit exceeded', {
    ip: req.ip,
    path: req.path,
    userId: req.auth?.userId,
  });

  res.status(429).json({
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
      statusCode: 429,
    },
  });
};

// Global rate limiter for all authenticated routes
// 100 requests per 15 minutes
export const globalRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: rateLimitHandler,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
  store: async () => {
    const client = await getRedisClient();
    if (client) {
      return new RedisStore({
        // @ts-expect-error - RedisStore types don't match latest redis client
        client,
        prefix: 'rl:global:',
      });
    }
    // Fall back to memory store in development
    return undefined;
  },
});

// Strict rate limiter for authentication endpoints (prevent brute force)
// 5 requests per 15 minutes
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful auth attempts
  handler: rateLimitHandler,
  keyGenerator: (req) => {
    // Rate limit by IP + email/username if provided
    const identifier = req.body?.email || req.body?.username || '';
    return `${req.ip}-${identifier}`;
  },
  store: async () => {
    const client = await getRedisClient();
    if (client) {
      return new RedisStore({
        // @ts-expect-error - RedisStore types don't match latest redis client
        client,
        prefix: 'rl:auth:',
      });
    }
    return undefined;
  },
});

// Very strict rate limiter for AI/expensive operations
// 10 requests per hour
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => {
    // Rate limit by user ID for authenticated requests
    const userId = req.auth?.userId || req.ip;
    return userId;
  },
  store: async () => {
    const client = await getRedisClient();
    if (client) {
      return new RedisStore({
        // @ts-expect-error - RedisStore types don't match latest redis client
        client,
        prefix: 'rl:ai:',
      });
    }
    return undefined;
  },
});

// Moderate rate limiter for file uploads
// 20 requests per hour
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => {
    const userId = req.auth?.userId || req.ip;
    return userId;
  },
  store: async () => {
    const client = await getRedisClient();
    if (client) {
      return new RedisStore({
        // @ts-expect-error - RedisStore types don't match latest redis client
        client,
        prefix: 'rl:upload:',
      });
    }
    return undefined;
  },
});

// Initialize Redis client on module load
if (config.nodeEnv === 'production') {
  getRedisClient().catch((err) => {
    logger.error('Failed to initialize rate limit Redis client', { error: err });
  });
}
