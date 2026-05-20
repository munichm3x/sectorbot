// src/dashboard/server.ts
// Express dashboard server. Started conditionally from src/index.ts.
// Static files served from dashboard/public/ (project root, not src/).

import express from 'express';
import session from 'express-session';
import connectSqlite3 from 'connect-sqlite3';
import { join } from 'path';
import { mkdirSync } from 'fs';
import type { Client } from 'discord.js';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { requireAuth, rateLimit } from './auth/middleware';
import { buildAuthRouter } from './routes/auth.routes';
import { buildApiRouter } from './routes/api/index';

const SQLiteStore = connectSqlite3(session);

export function startDashboard(client: Client): void {
  const app = express();

  // Parse JSON bodies (max 1 MB)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  // Trust proxy (important when behind nginx/PM2 for correct req.ip)
  app.set('trust proxy', 1);

  // Ensure session DB directory exists
  mkdirSync('./data', { recursive: true });

  // Session store backed by SQLite (separate file from bot DB)
  app.use(session({
    // connect-sqlite3 typing is imperfect — cast as never
    store: new SQLiteStore({ db: 'dashboard-sessions.db', dir: './data' }) as never,
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

  // Protected API routes
  app.use('/api', requireAuth, buildApiRouter(client));

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
  });
}
