import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ErrorCodes } from '@carecompanion/shared';
import { logger } from '../utils/logger';

export class ApiError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 400,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
  
  // Log error
  logger.error('Request error', {
    error: err,
    requestId,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: (req as any).auth?.userId,
  });

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        details: err.errors,
        requestId,
      },
    });
  }

  // Handle custom API errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId,
      },
    });
  }

  // Handle Clerk auth errors
  if (err.message?.includes('Unauthorized')) {
    return res.status(401).json({
      error: {
        code: ErrorCodes.UNAUTHORIZED,
        message: 'Authentication required',
        requestId,
      },
    });
  }

  // Default error response
  const isDevelopment = process.env.NODE_ENV === 'development';
  return res.status(500).json({
    error: {
      code: ErrorCodes.DATABASE_ERROR,
      message: isDevelopment ? err.message : 'Internal server error',
      requestId,
      ...(isDevelopment && { stack: err.stack }),
    },
  });
}