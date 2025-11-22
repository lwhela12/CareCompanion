import { Request, Response, NextFunction } from 'express';
import { doubleCsrf } from 'csrf-csrf';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * CSRF Protection Middleware
 * Uses the Double Submit Cookie pattern for SPA compatibility
 */

const csrfSecret = process.env.CSRF_SECRET || config.clerk.secretKey || 'default-csrf-secret';

const {
  generateToken,
  doubleCsrfProtection,
  invalidCsrfTokenError,
} = doubleCsrf({
  getSecret: () => csrfSecret,
  cookieName: '__Host-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: config.nodeEnv === 'production',
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getTokenFromRequest: (req) => {
    // Check header first (preferred for SPAs)
    const headerToken = req.headers['x-csrf-token'];
    if (headerToken) {
      return Array.isArray(headerToken) ? headerToken[0] : headerToken;
    }
    // Fallback to body for form submissions
    return req.body?._csrf;
  },
});

/**
 * Generate CSRF token for the client
 * GET /api/v1/csrf-token
 */
export function getCsrfToken(req: Request, res: Response) {
  const token = generateToken(req, res);
  res.json({ csrfToken: token });
}

/**
 * CSRF protection middleware
 * Apply to all state-changing routes (POST, PUT, PATCH, DELETE)
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for non-browser clients (mobile apps, etc.)
  const userAgent = req.get('user-agent') || '';
  const isMobileApp = userAgent.includes('CareCompanionMobile');

  // Skip for development if needed
  if (config.nodeEnv === 'development' && process.env.SKIP_CSRF === 'true') {
    return next();
  }

  // Skip for webhook endpoints
  if (req.path.includes('/webhook')) {
    return next();
  }

  // Skip for Clerk auth endpoints (they have their own protection)
  if (req.path.includes('/clerk')) {
    return next();
  }

  // Apply CSRF protection
  doubleCsrfProtection(req, res, (err: any) => {
    if (err === invalidCsrfTokenError) {
      logger.warn('Invalid CSRF token', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      return res.status(403).json({
        error: 'Invalid CSRF token',
        message: 'Your session may have expired. Please refresh the page.',
      });
    }
    if (err) {
      return next(err);
    }
    next();
  });
};

export { generateToken };
