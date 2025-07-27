import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps async route handlers to properly handle promise rejections
 */
export const asyncHandler = (fn: RequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};