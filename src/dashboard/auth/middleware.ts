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
  isContentEditor: boolean;
  guildId:   string;
}

declare module 'express-session' {
  interface SessionData {
    user?:       DashboardUser;
    oauthState?: string;
    publicUser?: {
      userId:   string;
      username: string;
      avatar:   string | null;
      guildId:  string;
    };
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

/** Require an authenticated session. Redirects pages to /login.html; returns 401 for API routes.
 * Note: when mounted at /api, Express strips the prefix so req.path is e.g. "/me", not "/api/me".
 * We detect API context via req.baseUrl instead.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user) {
    const isApiRequest = req.baseUrl.startsWith('/api') || req.headers.accept?.includes('application/json');
    if (isApiRequest) {
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

/** Require Moderator+ OR isContentEditor flag (for content CRUD routes). */
export function requireContentEditor(req: Request, res: Response, next: NextFunction): void {
  const user = req.session.user;
  if (!user || (user.permLevel < PermLevel.Moderator && !user.isContentEditor)) {
    res.status(403).json({ success: false, error: 'Insufficient permissions' });
    return;
  }
  next();
}

/** Check if a list of role IDs includes any from a configured list. */
export function isContentEditorFromRoles(roles: string[]): boolean {
  return env.DASHBOARD_EDITOR_ROLE_IDS.some(r => roles.includes(r));
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
      // Opportunistically purge expired entries to prevent unbounded growth
      for (const [k, v] of rateStore) {
        if (now >= v.resetAt) rateStore.delete(k);
      }
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

// ─── Startup config warning ───────────────────────────────────────────────────

/**
 * Call once at dashboard startup. Warns if no permission restrictions are configured,
 * which means any authenticated Discord user gets Viewer access.
 */
export function warnIfOpenAccess(): void {
  if (
    env.DASHBOARD_ALLOWED_USER_IDS.length === 0 &&
    env.DASHBOARD_ADMIN_ROLE_IDS.length === 0 &&
    env.DASHBOARD_MOD_ROLE_IDS.length === 0
  ) {
    // Import logger lazily to avoid circular deps
    const { logger } = require('../../utils/logger') as typeof import('../../utils/logger');
    logger.warn('[dashboard] WARNUNG: Keine Berechtigungs-Konfiguration gesetzt. Jeder Discord-User hat Viewer-Zugriff. Setze DASHBOARD_ALLOWED_USER_IDS oder DASHBOARD_ADMIN_ROLE_IDS.');
  }
}
