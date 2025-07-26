export enum ErrorCodes {
  // Client errors
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',

  // Server errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

export class AppError extends Error {
  constructor(
    public code: ErrorCodes,
    public message: string,
    public details?: any,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AppError';
    
    // Set default status codes based on error code
    if (!statusCode) {
      switch (code) {
        case ErrorCodes.BAD_REQUEST:
        case ErrorCodes.VALIDATION_ERROR:
        case ErrorCodes.INVALID_REQUEST:
          this.statusCode = 400;
          break;
        case ErrorCodes.UNAUTHORIZED:
          this.statusCode = 401;
          break;
        case ErrorCodes.FORBIDDEN:
          this.statusCode = 403;
          break;
        case ErrorCodes.NOT_FOUND:
          this.statusCode = 404;
          break;
        case ErrorCodes.CONFLICT:
          this.statusCode = 409;
          break;
        default:
          this.statusCode = 500;
      }
    }
  }
}

export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
}