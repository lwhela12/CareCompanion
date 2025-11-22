import { prisma } from '@carecompanion/database';
import { createClient } from 'redis';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { config } from '../config';
import { logger } from './logger';

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  error?: string;
}

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  environment: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    s3: ServiceHealth;
  };
}

/**
 * Check database connectivity by running a simple query
 */
async function checkDatabase(): Promise<ServiceHealth> {
  const startTime = Date.now();

  try {
    // Simple query to check connectivity
    await prisma.$queryRaw`SELECT 1`;

    const responseTime = Date.now() - startTime;

    return {
      status: 'healthy',
      responseTime,
    };
  } catch (error: any) {
    logger.error('Database health check failed', { error });

    return {
      status: 'unhealthy',
      error: error.message || 'Database connection failed',
    };
  }
}

/**
 * Check Redis connectivity by pinging the server
 */
async function checkRedis(): Promise<ServiceHealth> {
  const startTime = Date.now();
  let client: ReturnType<typeof createClient> | null = null;

  try {
    client = createClient({
      url: config.redisUrl,
    });

    await client.connect();

    // Ping Redis
    const pong = await client.ping();

    if (pong !== 'PONG') {
      throw new Error('Redis ping response invalid');
    }

    const responseTime = Date.now() - startTime;

    await client.disconnect();

    return {
      status: 'healthy',
      responseTime,
    };
  } catch (error: any) {
    logger.error('Redis health check failed', { error });

    if (client) {
      try {
        await client.disconnect();
      } catch (disconnectError) {
        // Ignore disconnect errors
      }
    }

    return {
      status: 'unhealthy',
      error: error.message || 'Redis connection failed',
    };
  }
}

/**
 * Check S3 connectivity by verifying bucket access
 */
async function checkS3(): Promise<ServiceHealth> {
  const startTime = Date.now();

  try {
    const clientConfig: any = {
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      },
    };

    // Add endpoint for LocalStack (local development)
    if (process.env.AWS_ENDPOINT_URL) {
      clientConfig.endpoint = process.env.AWS_ENDPOINT_URL;
      clientConfig.forcePathStyle = true;
    }

    const s3Client = new S3Client(clientConfig);

    // Check if bucket exists and is accessible
    const command = new HeadBucketCommand({
      Bucket: config.aws.s3BucketName,
    });

    await s3Client.send(command);

    const responseTime = Date.now() - startTime;

    return {
      status: 'healthy',
      responseTime,
    };
  } catch (error: any) {
    logger.error('S3 health check failed', { error });

    return {
      status: 'unhealthy',
      error: error.message || 'S3 connection failed',
    };
  }
}

/**
 * Run all health checks and return aggregated results
 */
export async function performHealthChecks(): Promise<HealthCheckResult> {
  // Run all checks in parallel for faster response
  const [databaseHealth, redisHealth, s3Health] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkS3(),
  ]);

  // Determine overall status
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  const services = [databaseHealth, redisHealth, s3Health];
  const unhealthyCount = services.filter(s => s.status === 'unhealthy').length;
  const degradedCount = services.filter(s => s.status === 'degraded').length;

  if (unhealthyCount > 0) {
    // If database is down, system is unhealthy (critical dependency)
    // If Redis or S3 is down, system is degraded (non-critical)
    if (databaseHealth.status === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else {
      overallStatus = 'degraded';
    }
  } else if (degradedCount > 0) {
    overallStatus = 'degraded';
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    services: {
      database: databaseHealth,
      redis: redisHealth,
      s3: s3Health,
    },
  };
}
