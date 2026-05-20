// src/dashboard/auth/middleware.ts
// Session type augmentation + auth/permission middleware.

import type { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';

// ─── Permission Levels ────────────────────────────────────────────────────────

export enum PermLevel {
  Viewer    = 1,
  Moderator = 2,
  Admin     = 3,
  Owner     = 4,
}

// ─── Session type augmentation ────────────────────────────────────────────────

export interface DashboardUser {
  userId:    string;
  username:  string;
  avatar:    string | null;
  permLevel: PermLevel;
  guildId:   string;
}

declare module 'express-session' {
  interface SessionData {
    user?:       DashboardUser;
    oauthState?: string;
  }
}

// ─── Permission determination ─────────────────────────────────────────────────

/**
 * Determine permission level for a user given their Discord user ID and guild roles.
 * Returns null if user has no dashboard access.
 */
export function determinePermLevel(userId: string, roles: string[]): PermLevel | null {
  if (env.DASHBOARD_ALLOWED_USER_IDS.includes(userId)) return PermLevel.Owner;
  if (env.DASHBOARD_ADMIN_ROLE_IDS.some(r => roles.includes(r))) return PermLevel.Admin;
  if (env.DASHBOARD_MOD_ROLE_IDS.some(r => roles.includes(r))) return PermLevel.Moderator;
  // If no role restrictions are configured at all, grant Viewer to any authenticated user
  if (
    env.DASHBOARD_ALLOWED_USER_IDS.length === 0 &&
    env.DASHBOARD_ADMIN_ROLE_IDS.length === 0 &&
    env.DASHBOARD_MOD_ROLE_IDS.length === 0
  ) {
    return PermLevel.Viewer;
  }
  return null;
}

// ─── Middleware ────────────────────────────────────────────────────────────────

/** Require an authenticated session. Redirects pages to /login.html; returns 401 for API routes. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user) {
    if (req.path.startsWith('/api/') || req.headers.accept?.includes('application/json')) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
    } else {
      res.redirect('/login.html');
    }
    return;
  }
  next();
}

/** Require a minimum permission level. Returns 403 with JSON error if insufficient. */
export function requirePermission(level: PermLevel) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.session.user;
    if (!user || user.permLevel < level) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

// ─── Simple in-process rate limiter ──────────────────────────────────────────

const rateStore = new Map<string, { count: number; resetAt: number }>();

/** Limit to maxRequests per windowMs per IP. Returns 429 if exceeded. */
export function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip  = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = rateStore.get(ip);

    if (!entry || now >= entry.resetAt) {
      rateStore.set(ip, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (entry.count >= maxRequests) {
      res.status(429).json({ success: false, error: 'Too many requests. Try again later.' });
      return;
    }

    entry.count++;
    next();
  };
}
