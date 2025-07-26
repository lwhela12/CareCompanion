import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  databaseUrl: process.env.DATABASE_URL!,
  
  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // Auth
  clerk: {
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY!,
    secretKey: process.env.CLERK_SECRET_KEY!,
  },
  
  // OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY!,
  
  // AWS S3
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    region: process.env.AWS_REGION || 'us-east-1',
    s3BucketName: process.env.S3_BUCKET_NAME || 'carecompanion-documents',
  },
  
  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'debug',
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  },
  
  // File upload
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
} as const;

// Validate required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}