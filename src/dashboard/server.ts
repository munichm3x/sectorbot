// src/dashboard/server.ts
// Express dashboard server. Started conditionally from src/index.ts.
// Static files served from dashboard/public/ (project root, not src/).

import express from 'express';
import session from 'express-session';
import connectSqlite3 from 'connect-sqlite3';
import { join } from 'path';
import { mkdirSync } from 'fs';
import helmet from 'helmet';
import type { Client } from 'discord.js';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { requireAuth, rateLimit } from './auth/middleware';
import { doubleCsrfProtection } from './auth/csrf';
import { buildAuthRouter } from './routes/auth.routes';
import { buildApiRouter } from './routes/api/index';
import { buildPublicApiRouter } from './routes/public-api/index';

const SQLiteStore = connectSqlite3(session);

export function startDashboard(client: Client): void {
  const app = express();

  // Parse JSON bodies (max 1 MB)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  // Trust proxy (important when behind nginx/PM2 for correct req.ip)
  app.set('trust proxy', 1);

  // Security headers
  app.use(helmet({
    hsts: false,
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        styleSrc:    ["'self'", "'unsafe-inline'"],
        imgSrc:      ["'self'", 'data:', 'https://cdn.discordapp.com'],
        connectSrc:  ["'self'"],
        fontSrc:     ["'self'"],
        objectSrc:   ["'none'"],
        frameSrc:    ["'none'"],
      },
    },
  }));

  // Ensure session DB directory exists
  const DATA_DIR = join(process.cwd(), 'data');
  mkdirSync(DATA_DIR, { recursive: true });

  // Guard against running with the default weak secret
  if (env.DASHBOARD_SESSION_SECRET === 'change-me-in-production') {
    logger.warn('[dashboard] WARNUNG: DASHBOARD_SESSION_SECRET ist der Standard-Wert. Bitte in .env setzen!');
    if (env.NODE_ENV === 'production') {
      throw new Error('DASHBOARD_SESSION_SECRET muss in Produktion gesetzt werden.');
    }
  }

  // Guard against missing Discord client secret
  if (!env.DISCORD_CLIENT_SECRET) {
    logger.warn('[dashboard] WARNUNG: DISCORD_CLIENT_SECRET ist nicht gesetzt — OAuth-Login funktioniert nicht.');
    if (env.NODE_ENV === 'production') {
      throw new Error('DISCORD_CLIENT_SECRET muss in Produktion gesetzt werden.');
    }
  }

  // Session store backed by SQLite (separate file from bot DB)
  app.use(session({
    // connect-sqlite3 typing is imperfect — cast as never
    store: new SQLiteStore({ db: 'dashboard-sessions.db', dir: DATA_DIR }) as never,
    secret:            env.DASHBOARD_SESSION_SECRET,
    resave:            false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure:   env.NODE_ENV === 'production',
      maxAge:   24 * 60 * 60 * 1000, // 24 hours
    },
  }));

  // Auth routes (rate-limited: 10 req/min per IP)
  app.use('/auth', rateLimit(10, 60_000), buildAuthRouter(client));

  // Protected API routes — rate-limited (100/min), then auth + CSRF
  app.use('/api', rateLimit(100, 60_000), requireAuth, doubleCsrfProtection, buildApiRouter(client));

  // Public user API (must come before /public static middleware)
  app.use('/public-api', buildPublicApiRouter(client));

  // Public user static files
  const PUBLIC_USER_DIR = join(process.cwd(), 'dashboard', 'public-user');
  app.use('/public', express.static(PUBLIC_USER_DIR));

  // SPA fallback for /public/* paths (client-side routing)
  app.get('/public/*', (_req, res) => {
    res.sendFile('index.html', { root: PUBLIC_USER_DIR }, (err) => {
      if (err) res.status(404).send('Public dashboard not found.');
    });
  });

  // Static files: HTML/CSS/JS from dashboard/public/ at project root
  const PUBLIC_DIR = join(process.cwd(), 'dashboard', 'public');
  app.use(express.static(PUBLIC_DIR));

  // SPA fallback: serve index.html for unknown paths (client-side routing)
  app.get('*', (req, res) => {
    if (req.path.startsWith('/auth/') || req.path.startsWith('/api/')) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    res.sendFile('index.html', { root: PUBLIC_DIR }, (err) => {
      if (err) res.status(404).send('Dashboard not found. Run Sub-project C to build the frontend.');
    });
  });

  // Global error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('[dashboard] Unbehandelter Fehler:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  });

  app.listen(env.DASHBOARD_PORT, () => {
    logger.info(`[dashboard] Dashboard läuft auf Port ${env.DASHBOARD_PORT} — ${env.NODE_ENV}`);
    logger.info(`[dashboard] URL: http://localhost:${env.DASHBOARD_PORT}`);
  }).on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`[dashboard] Port ${env.DASHBOARD_PORT} ist bereits belegt. Dashboard konnte nicht gestartet werden.`);
    } else {
      logger.error('[dashboard] Server-Fehler:', err.message);
    }
    // Do NOT re-throw — let the bot continue running without the dashboard
  });
}
