// src/dashboard/auth/public-middleware.ts
// Auth middleware for the public user dashboard (/public-api/*).
// Uses req.session.publicUser — completely separate from admin req.session.user.

import type { Request, Response, NextFunction } from 'express';

/**
 * Require a publicUser session.
 * - API requests (baseUrl starts with /public-api, or Accept: application/json) → 401 JSON
 * - Page requests → redirect to /public/login.html
 */
export function requirePublicAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.publicUser) {
    const isApi = req.baseUrl.startsWith('/public-api') || req.headers.accept?.includes('application/json');
    if (isApi) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
    } else {
      res.redirect('/public/login.html');
    }
    return;
  }
  next();
}
