import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import crypto from 'crypto';

/**
 * Cache Service for Redis-based caching
 * Used for AI responses, expensive computations, and frequently accessed data
 */

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 100, 3000);
      },
    });

    redis.on('error', (err) => {
      logger.error('Redis cache error:', err);
    });
  }
  return redis;
}

// Default TTL values (in seconds)
export const CacheTTL = {
  SHORT: 60,           // 1 minute - for real-time data
  MEDIUM: 300,         // 5 minutes - for moderately dynamic data
  LONG: 3600,          // 1 hour - for stable data
  AI_RESPONSE: 1800,   // 30 minutes - for AI-generated content
  DAILY: 86400,        // 24 hours - for static data
} as const;

/**
 * Generate a cache key from components
 */
export function generateCacheKey(...parts: (string | number | undefined)[]): string {
  return parts.filter(Boolean).join(':');
}

/**
 * Generate a hash for large or complex data (like prompts)
 */
export function hashData(data: string | object): string {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
}

/**
 * Get a value from cache
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const value = await getRedis().get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    logger.error('Cache get error:', { key, error });
    return null;
  }
}

/**
 * Set a value in cache
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = CacheTTL.MEDIUM
): Promise<void> {
  try {
    await getRedis().setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    logger.error('Cache set error:', { key, error });
  }
}

/**
 * Delete a value from cache
 */
export async function cacheDelete(key: string): Promise<void> {
  try {
    await getRedis().del(key);
  } catch (error) {
    logger.error('Cache delete error:', { key, error });
  }
}

/**
 * Delete all keys matching a pattern
 */
export async function cacheDeletePattern(pattern: string): Promise<void> {
  try {
    const keys = await getRedis().keys(pattern);
    if (keys.length > 0) {
      await getRedis().del(...keys);
    }
  } catch (error) {
    logger.error('Cache delete pattern error:', { pattern, error });
  }
}

/**
 * Cache wrapper for async functions
 * Automatically caches the result of the function
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number = CacheTTL.MEDIUM
): Promise<T> {
  // Try to get from cache first
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    logger.debug('Cache hit', { key });
    return cached;
  }

  // Execute function and cache result
  logger.debug('Cache miss', { key });
  const result = await fn();
  await cacheSet(key, result, ttlSeconds);
  return result;
}

/**
 * AI-specific caching for expensive API calls
 */
export const aiCache = {
  /**
   * Cache key for AI summaries
   */
  summaryKey: (familyId: string, date: string = new Date().toISOString().split('T')[0]) =>
    generateCacheKey('ai', 'summary', familyId, date),

  /**
   * Cache key for AI insights
   */
  insightsKey: (familyId: string, days: number = 7) =>
    generateCacheKey('ai', 'insights', familyId, days.toString()),

  /**
   * Cache key for document parsing
   */
  documentParseKey: (documentId: string) =>
    generateCacheKey('ai', 'document', documentId),

  /**
   * Cache key for chat completions
   */
  chatKey: (familyId: string, promptHash: string) =>
    generateCacheKey('ai', 'chat', familyId, promptHash),

  /**
   * Cache AI summary
   */
  async getSummary(familyId: string): Promise<any | null> {
    return cacheGet(aiCache.summaryKey(familyId));
  },

  async setSummary(familyId: string, summary: any): Promise<void> {
    await cacheSet(aiCache.summaryKey(familyId), summary, CacheTTL.AI_RESPONSE);
  },

  /**
   * Invalidate all AI caches for a family (when data changes)
   */
  async invalidateFamily(familyId: string): Promise<void> {
    await cacheDeletePattern(`ai:*:${familyId}:*`);
    logger.info('Invalidated AI cache for family', { familyId });
  },
};

export const cacheService = {
  get: cacheGet,
  set: cacheSet,
  delete: cacheDelete,
  deletePattern: cacheDeletePattern,
  withCache,
  generateKey: generateCacheKey,
  hashData,
  aiCache,
};
