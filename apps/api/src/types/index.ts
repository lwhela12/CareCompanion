import { Request } from 'express';

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
  user?: {
    id: string;
    familyId?: string;
    role?: string;
    email: string;
    name: string;
  };
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