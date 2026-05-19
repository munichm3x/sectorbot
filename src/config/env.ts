import { config } from 'dotenv';

config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Fehlende Umgebungsvariable: ${key}`);
  return value;
}

export const env = {
  DISCORD_TOKEN:       requireEnv('DISCORD_TOKEN'),
  CLIENT_ID:           requireEnv('CLIENT_ID'),
  DATABASE_PATH:       process.env.DATABASE_PATH ?? './data/bot.db',
  NODE_ENV:            process.env.NODE_ENV ?? 'development',
  OLLAMA_URL:          process.env.OLLAMA_URL ?? 'http://localhost:11434/api/generate',
  OLLAMA_MODEL:        process.env.OLLAMA_MODEL ?? 'sector13-oldman',
  OLD_MAN_COOLDOWN_MS: (() => { const n = Number(process.env.OLD_MAN_COOLDOWN_MS); return Number.isFinite(n) && n >= 0 ? n : 5000; })(),
  OLLAMA_TIMEOUT_MS:   (() => { const n = Number(process.env.OLLAMA_TIMEOUT_MS);   return Number.isFinite(n) && n >= 0 ? n : 60000; })(),
  GROQ_API_KEY:        process.env.GROQ_API_KEY ?? '',
  STEAM_API_KEY:       process.env.STEAM_API_KEY ?? '',
  RULES_BANNER_URL:      process.env.RULES_BANNER_URL ?? '',
  SCUM_STATUS_LOGO_URL:  process.env.SCUM_STATUS_LOGO_URL ?? '',
} as const;
