// src/dashboard/routes/auth.routes.ts
// GET /auth/login   — redirect to Discord OAuth
// GET /auth/callback — handle code, create session
// GET /auth/logout   — destroy session
// GET /auth/denied   — access denied page

import { Router } from 'express';
import type { Client } from 'discord.js';
import {
  buildOAuthURL, exchangeCode, fetchDiscordUser,
  fetchGuildMember, generateState,
} from '../auth/discord-oauth';
import { determinePermLevel, isContentEditorFromRoles, PermLevel } from '../auth/middleware';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

function buildPublicOAuthURL(state: string): string {
  const params = new URLSearchParams({
    client_id:     env.CLIENT_ID,
    redirect_uri:  env.PUBLIC_DASHBOARD_OAUTH_CALLBACK_URL,
    response_type: 'code',
    scope:         'identify',
    state,
  });
  return `https://discord.com/api/oauth2/authorize?${params}`;
}

export function buildAuthRouter(client: Client): Router {
  const router = Router();

  // GET /auth/login
  router.get('/login', (req, res) => {
    const state = generateState();
    req.session.oauthState = state;
    req.session.save((err) => {
      if (err) {
        logger.error('[dashboard] Session-Speicherfehler beim Login:', err);
        res.status(500).send('Session error. Try again.');
        return;
      }
      res.redirect(buildOAuthURL(state));
    });
  });

  // GET /auth/callback
  router.get('/callback', async (req, res) => {
    try {
      const { code, state, error } = req.query as Record<string, string>;

      if (error) {
        logger.warn('[dashboard] OAuth denied by user:', error);
        res.redirect('/auth/denied?reason=oauth_denied');
        return;
      }

      if (!code || !state || state !== req.session.oauthState) {
        res.redirect('/auth/denied?reason=invalid_state');
        return;
      }

      // Exchange code for access token
      const tokenData = await exchangeCode(code);

      // Get Discord user info
      const discordUser = await fetchDiscordUser(tokenData.access_token);

      // Find the first guild the bot is in
      const guild = client.guilds.cache.first();
      if (!guild) {
        logger.error('[dashboard] Bot ist in keiner Guild — Auth nicht möglich.');
        res.redirect('/auth/denied?reason=no_guild');
        return;
      }

      // Get member info (roles) for permission check
      const member = await fetchGuildMember(tokenData.access_token, guild.id);
      const roles  = member?.roles ?? [];

      const permLevel = determinePermLevel(discordUser.id, roles);
      const isContentEditor = isContentEditorFromRoles(roles);
      // Content editors can be granted dashboard access even without explicit perm-level
      const effectivePerm = permLevel ?? (isContentEditor ? PermLevel.Viewer : null);
      if (effectivePerm === null) {
        logger.info(`[dashboard] Zugriff verweigert für ${discordUser.username} (${discordUser.id})`);
        res.redirect('/auth/denied?reason=no_permission');
        return;
      }

      // Regenerate session ID to prevent session fixation, then store user
      const newUser = {
        userId:    discordUser.id,
        username:  discordUser.global_name ?? discordUser.username,
        avatar:    discordUser.avatar,
        permLevel: effectivePerm,
        isContentEditor,
        guildId:   guild.id,
      };
      req.session.regenerate((regenErr) => {
        if (regenErr) {
          logger.error('[dashboard] Session-Regenerierungsfehler:', regenErr);
          res.status(500).send('Session error. Try again.');
          return;
        }
        req.session.user = newUser;
        req.session.save((saveErr) => {
          if (saveErr) {
            logger.error('[dashboard] Session-Speicherfehler nach Auth:', saveErr);
            res.status(500).send('Session error. Try again.');
            return;
          }
          logger.info(`[dashboard] Login: ${discordUser.username} (Level ${effectivePerm})`);
          res.redirect('/');
        });
      });
    } catch (err) {
      logger.error('[dashboard] Auth-Callback-Fehler:', err);
      res.redirect('/auth/denied?reason=error');
    }
  });

  // GET /auth/logout
  router.get('/logout', (req, res) => {
    const username = req.session.user?.username ?? 'unknown';
    req.session.destroy((err) => {
      if (err) logger.warn('[dashboard] Session-Destroy-Fehler:', err);
      else logger.info(`[dashboard] Logout: ${username}`);
      res.redirect('/login.html');
    });
  });

  // GET /auth/denied
  router.get('/denied', (req, res) => {
    const reason = String(req.query.reason ?? 'unknown');
    const messages: Record<string, string> = {
      no_permission: 'Du hast keine Berechtigung für dieses Dashboard.',
      oauth_denied:  'Discord-Login wurde abgebrochen.',
      invalid_state: 'Ungültige OAuth-Anfrage. Bitte versuche es erneut.',
      no_guild:      'Der Bot ist in keiner Guild.',
      error:         'Ein Fehler ist aufgetreten. Bitte versuche es erneut.',
    };
    res.status(403).send(`
      <!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
      <title>Zugriff verweigert — SECTOR 13</title>
      <style>body{font-family:monospace;background:#0a0a0c;color:#e8e8ee;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
      .box{background:#111115;border:1px solid #1e1e28;border-radius:8px;padding:2rem;text-align:center;max-width:400px}
      h1{color:#ed4245;margin-top:0}a{color:#8b0000;text-decoration:none}a:hover{text-decoration:underline}</style>
      </head><body><div class="box">
      <h1>Zugriff verweigert</h1>
      <p>${messages[reason] ?? messages.error}</p>
      <a href="/auth/login">← Erneut versuchen</a>
      </div></body></html>
    `);
  });

  // ─── Public OAuth (any guild member) ──────────────────────────────────────

  // GET /auth/public/login
  router.get('/public/login', (req, res) => {
    const state = generateState();
    req.session.oauthState = state;
    req.session.save((err) => {
      if (err) {
        logger.error('[public-dashboard] Session-Speicherfehler beim Public-Login:', err);
        res.status(500).send('Session error. Try again.');
        return;
      }
      res.redirect(buildPublicOAuthURL(state));
    });
  });

  // GET /auth/public/callback
  router.get('/public/callback', async (req, res) => {
    try {
      const { code, state, error } = req.query as Record<string, string>;

      if (error) {
        logger.warn('[public-dashboard] OAuth denied:', error);
        res.redirect('/auth/denied?reason=oauth_denied');
        return;
      }

      if (!code || !state || state !== req.session.oauthState) {
        res.redirect('/auth/denied?reason=invalid_state');
        return;
      }

      // Exchange code for access token (scopes: identify only)
      const tokenData = await exchangeCode(code, env.PUBLIC_DASHBOARD_OAUTH_CALLBACK_URL);

      // Get Discord user info
      const discordUser = await fetchDiscordUser(tokenData.access_token);

      // Find the bot's first guild
      const guild = client.guilds.cache.first();
      if (!guild) {
        logger.error('[public-dashboard] Bot ist in keiner Guild.');
        res.redirect('/auth/denied?reason=no_guild');
        return;
      }

      // Verify guild membership using the bot cache (no extra OAuth scope needed)
      let member;
      try {
        member = await guild.members.fetch(discordUser.id);
      } catch {
        member = null;
      }
      if (!member) {
        logger.info(`[public-dashboard] Nicht in Guild: ${discordUser.username} (${discordUser.id})`);
        res.redirect('/auth/denied?reason=not_in_guild');
        return;
      }

      // Regenerate session ID to prevent session fixation, then store publicUser
      const newPublicUser = {
        userId:   discordUser.id,
        username: discordUser.global_name ?? discordUser.username,
        avatar:   discordUser.avatar,
        guildId:  guild.id,
      };
      req.session.regenerate((regenErr) => {
        if (regenErr) {
          logger.error('[public-dashboard] Session-Regenerierungsfehler:', regenErr);
          res.status(500).send('Session error. Try again.');
          return;
        }
        req.session.publicUser = newPublicUser;
        req.session.save((saveErr) => {
          if (saveErr) {
            logger.error('[public-dashboard] Session-Speicherfehler nach Auth:', saveErr);
            res.status(500).send('Session error. Try again.');
            return;
          }
          logger.info(`[public-dashboard] Public Login: ${discordUser.username}`);
          res.redirect('/public/');
        });
      });
    } catch (err) {
      logger.error('[public-dashboard] Public-Callback-Fehler:', err);
      res.redirect('/auth/denied?reason=error');
    }
  });

  // GET /auth/public/logout
  router.get('/public/logout', (req, res) => {
    const username = req.session.publicUser?.username ?? 'unknown';
    // Only clear publicUser, preserve any admin session
    req.session.publicUser = undefined;
    req.session.save((err) => {
      if (err) logger.warn('[public-dashboard] Logout-Fehler:', err);
      else logger.info(`[public-dashboard] Public Logout: ${username}`);
      res.redirect('/public/login.html');
    });
  });

  return router;
}
