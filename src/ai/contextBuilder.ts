/**
 * ContextBuilder — enriches a Discord message into a DiscordContext object.
 *
 * Provides:
 *  - current message text
 *  - replied-to message (if Discord reply)
 *  - last N messages from channel history (oldest first)
 *  - author display name + top role names
 *  - channel name
 *  - combined knowledge from data/knowledge/*.md files
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Message, TextChannel } from 'discord.js';
import type { DiscordContext, ChannelHistoryEntry } from './types';
import { logger } from '../utils/logger';

// ─── Knowledge loading (cached at module startup) ─────────────────────────────

const KNOWLEDGE_DIR = join(process.cwd(), 'data', 'knowledge');

function loadKnowledge(): string {
  try {
    const files = readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.md'));
    if (files.length === 0) return '';

    const sections = files.map(f => {
      try {
        const content = readFileSync(join(KNOWLEDGE_DIR, f), 'utf-8').trim();
        return `### ${f.replace('.md', '')}\n${content}`;
      } catch {
        return null;
      }
    }).filter(Boolean);

    return sections.join('\n\n');
  } catch {
    // knowledge dir may not exist yet — that's fine
    return '';
  }
}

/** Cached at module load. Restart bot to reload knowledge files. */
const CACHED_KNOWLEDGE: string = loadKnowledge();

if (CACHED_KNOWLEDGE) {
  logger.info(`[ContextBuilder] Knowledge loaded: ${CACHED_KNOWLEDGE.length} chars`);
} else {
  logger.info('[ContextBuilder] No knowledge files found in data/knowledge/ — skipping');
}

// ─── Main export ──────────────────────────────────────────────────────────────

const MAX_HISTORY_MESSAGES = 15;
const MAX_MSG_LEN          = 350;  // truncate individual history messages

/**
 * Builds a rich DiscordContext from a Discord.js Message object.
 * Fetches channel history and resolved reply asynchronously.
 */
export async function buildDiscordContext(message: Message): Promise<DiscordContext> {
  // Current message author info
  const authorName  = message.member?.displayName ?? message.author.username;
  const authorRoles = (message.member?.roles.cache
    .filter(r => r.name !== '@everyone')
    .sort((a, b) => b.position - a.position)
    .first(3)
    ?.map(r => r.name)) ?? [];

  const channelName = 'name' in message.channel ? (message.channel as TextChannel).name : 'unknown';

  // ── Replied-to message ────────────────────────────────────────────────────
  let replyTo: DiscordContext['replyTo'];
  if (message.reference?.messageId) {
    try {
      const ref = await message.channel.messages.fetch(message.reference.messageId);
      const refAuthor = ref.member?.displayName ?? ref.author.username;
      replyTo = {
        authorName: refAuthor,
        content:    truncate(ref.content, 400),
      };
    } catch {
      // Reply may be deleted — ignore silently
    }
  }

  // ── Channel history ───────────────────────────────────────────────────────
  let channelHistory: ChannelHistoryEntry[] = [];
  try {
    const fetched = await message.channel.messages.fetch({ limit: MAX_HISTORY_MESSAGES + 1, before: message.id });
    channelHistory = [...fetched.values()]
      .reverse()                         // oldest first
      .filter(m => m.id !== message.id)  // exclude current
      .slice(-MAX_HISTORY_MESSAGES)
      .map(m => ({
        authorName: m.member?.displayName ?? m.author.username,
        content:    truncate(m.content, MAX_MSG_LEN),
        isBot:      m.author.bot,
      }));
  } catch (err) {
    logger.warn('[ContextBuilder] Could not fetch channel history', err);
  }

  return {
    currentMessage: truncate(message.content, 500),
    authorName,
    authorRoles,
    channelName,
    replyTo,
    channelHistory,
    knowledge: CACHED_KNOWLEDGE,
  };
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.lastIndexOf(' ', max);
  return (cut > 0 ? text.slice(0, cut) : text.slice(0, max)) + '…';
}
