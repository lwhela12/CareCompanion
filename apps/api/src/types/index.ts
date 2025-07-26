import { Request } from 'express';
import { User } from '@carecompanion/database';

export interface AuthRequest extends Request {
  auth?: {
    userId: string;
    sessionId: string;
    sessionClaims?: {
      email?: string;
      firstName?: string;
      lastName?: string;
      [key: string]: any;
    };
  };
  user?: User;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: ApiError;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}