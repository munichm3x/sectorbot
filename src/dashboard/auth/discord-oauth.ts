// src/dashboard/auth/discord-oauth.ts
// Discord OAuth2 helpers — no Passport.js, plain fetch calls.
// Scopes: identify guilds guilds.members.read

import { env } from '../../config/env';

const DISCORD_API = 'https://discord.com/api/v10';

export interface DiscordTokenResponse {
  access_token: string;
  token_type:   string;
  expires_in:   number;
  scope:        string;
}

export interface DiscordUser {
  id:          string;
  username:    string;
  global_name: string | null;
  avatar:      string | null;
}

export interface DiscordGuildMember {
  roles: string[];
  nick:  string | null;
}

/** Build the Discord authorization URL. State is a random nonce stored in session. */
export function buildOAuthURL(state: string): string {
  const params = new URLSearchParams({
    client_id:     env.CLIENT_ID,
    redirect_uri:  env.DISCORD_OAUTH_CALLBACK_URL,
    response_type: 'code',
    scope:         'identify guilds guilds.members.read',
    state,
  });
  return `https://discord.com/api/oauth2/authorize?${params}`;
}

/** Exchange authorization code for access token. */
export async function exchangeCode(code: string, redirectUri?: string): Promise<DiscordTokenResponse> {
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     env.CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type:    'authorization_code',
      code,
      redirect_uri:  redirectUri ?? env.DISCORD_OAUTH_CALLBACK_URL,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord token exchange failed ${res.status}: ${text}`);
  }
  return res.json() as Promise<DiscordTokenResponse>;
}

/** Fetch the authenticated user's Discord profile. */
export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Discord user fetch failed: ${res.status}`);
  return res.json() as Promise<DiscordUser>;
}

/** Fetch the authenticated user's member info for a specific guild. Returns null if not in guild. */
export async function fetchGuildMember(accessToken: string, guildId: string): Promise<DiscordGuildMember | null> {
  const res = await fetch(`${DISCORD_API}/users/@me/guilds/${guildId}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`Discord member fetch failed: ${res.status}`);
  return res.json() as Promise<DiscordGuildMember>;
}

/** Generate a random state nonce for CSRF protection. */
export function generateState(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
