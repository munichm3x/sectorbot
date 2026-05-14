import { config } from 'dotenv';

config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Fehlende Umgebungsvariable: ${key}`);
  return value;
}

export const env = {
  DISCORD_TOKEN:  requireEnv('DISCORD_TOKEN'),
  CLIENT_ID:      requireEnv('CLIENT_ID'),
  DATABASE_PATH:  process.env.DATABASE_PATH ?? './data/bot.db',
  NODE_ENV:       process.env.NODE_ENV ?? 'development',
  LORE_CHANNEL_ID: process.env.LORE_CHANNEL_ID ?? '',
  OLLAMA_URL:      process.env.OLLAMA_URL ?? 'http://localhost:11434/api/generate',
  OLLAMA_MODEL:    process.env.OLLAMA_MODEL ?? 'llama3.1:8b',
} as const;
