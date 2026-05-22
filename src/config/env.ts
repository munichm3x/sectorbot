import { config } from 'dotenv';

config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Fehlende Umgebungsvariable: ${key}`);
  return value;
}

function envInt(key: string, fallback: number): number {
  const n = Number(process.env[key]);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  if (v === 'true'  || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no')  return false;
  return fallback;
}

function envList(key: string): string[] {
  return (process.env[key] ?? '').split(',').map(s => s.trim()).filter(Boolean);
}

export const env = {
  // Bot core
  DISCORD_TOKEN:       requireEnv('DISCORD_TOKEN'),
  CLIENT_ID:           requireEnv('CLIENT_ID'),
  DATABASE_PATH:       process.env.DATABASE_PATH ?? './data/bot.db',
  NODE_ENV:            process.env.NODE_ENV ?? 'development',

  // AI — Provider
  AI_PROVIDER:          process.env.AI_PROVIDER          ?? 'gemini',  // gemini | groq | openrouter
  AI_FALLBACK_PROVIDER: process.env.AI_FALLBACK_PROVIDER ?? 'groq',    // used if primary fails
  AI_MODEL:             process.env.AI_MODEL             ?? '',        // empty = provider default

  // AI — Gemini
  GEMINI_API_KEY:      process.env.GEMINI_API_KEY ?? '',

  // AI — Groq (kept for fallback / legacy)
  GROQ_API_KEY:        process.env.GROQ_API_KEY ?? '',

  // AI — OpenRouter (optional)
  OPENROUTER_API_KEY:  process.env.OPENROUTER_API_KEY ?? '',

  // AI — Ollama (local fallback)
  OLLAMA_URL:          process.env.OLLAMA_URL ?? 'http://localhost:11434/api/generate',
  OLLAMA_MODEL:        process.env.OLLAMA_MODEL ?? 'sector13-oldman',
  OLD_MAN_COOLDOWN_MS: envInt('OLD_MAN_COOLDOWN_MS', 5000),
  OLLAMA_TIMEOUT_MS:   envInt('OLLAMA_TIMEOUT_MS', 60000),

  // External
  STEAM_API_KEY:           process.env.STEAM_API_KEY ?? '',
  RULES_BANNER_URL:        process.env.RULES_BANNER_URL ?? '',
  SCUM_STATUS_LOGO_URL:    process.env.SCUM_STATUS_LOGO_URL ?? '',
  SCUM_STATUS_BANNER_URL:  process.env.SCUM_STATUS_BANNER_URL ?? '',

  // Analytics
  ANALYTICS_ENABLED:                    envBool('ANALYTICS_ENABLED', true),
  ANALYTICS_MESSAGE_ENABLED:            envBool('ANALYTICS_MESSAGE_ENABLED', true),
  ANALYTICS_VOICE_ENABLED:              envBool('ANALYTICS_VOICE_ENABLED', true),
  ANALYTICS_STREAM_ENABLED:             envBool('ANALYTICS_STREAM_ENABLED', true),
  ANALYTICS_AI_ENABLED:                 envBool('ANALYTICS_AI_ENABLED', true),
  ANALYTICS_RETENTION_RAW_DAYS:         envInt('ANALYTICS_RETENTION_RAW_DAYS', 7),
  ANALYTICS_RETENTION_AGGREGATED_DAYS:  envInt('ANALYTICS_RETENTION_AGGREGATED_DAYS', 365),
  ANALYTICS_AGGREGATION_INTERVAL_MIN:   envInt('ANALYTICS_AGGREGATION_INTERVAL_MINUTES', 15),

  // Dashboard
  DASHBOARD_ENABLED:              envBool('DASHBOARD_ENABLED', false),
  DASHBOARD_PORT:                 envInt('DASHBOARD_PORT', 3000),
  DASHBOARD_SESSION_SECRET:       process.env.DASHBOARD_SESSION_SECRET ?? 'change-me-in-production',
  DISCORD_CLIENT_SECRET:          process.env.DISCORD_CLIENT_SECRET ?? '',
  DISCORD_OAUTH_CALLBACK_URL:     process.env.DISCORD_OAUTH_CALLBACK_URL ?? 'http://localhost:3000/auth/callback',
  PUBLIC_DASHBOARD_OAUTH_CALLBACK_URL: process.env.PUBLIC_DASHBOARD_OAUTH_CALLBACK_URL ?? 'http://localhost:3000/auth/public/callback',
  DASHBOARD_ALLOWED_USER_IDS:     envList('DASHBOARD_ALLOWED_USER_IDS'),
  DASHBOARD_ADMIN_ROLE_IDS:       envList('DASHBOARD_ADMIN_ROLE_IDS'),
  DASHBOARD_MOD_ROLE_IDS:         envList('DASHBOARD_MOD_ROLE_IDS'),
  DASHBOARD_EDITOR_ROLE_IDS:      envList('DASHBOARD_EDITOR_ROLE_IDS'),
} as const;
