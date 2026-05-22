/**
 * Shared types for the modular AI provider architecture.
 */

// ─── Core Message Format ──────────────────────────────────────────────────────

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

// ─── Provider Interface ───────────────────────────────────────────────────────

export interface AIProvider {
  /** Short identifier shown in logs, e.g. "gemini", "groq", "openrouter" */
  readonly name: string;
  /** Model name used, e.g. "gemini-1.5-flash" */
  readonly model: string;
  /** Send a chat completion request and return the text response. */
  ask(messages: ChatMessage[]): Promise<string>;
}

// ─── Service Result ───────────────────────────────────────────────────────────

export interface AskResult {
  text:         string;
  provider:     string;
  model:        string;
  usedFallback: boolean;
  durationMs:   number;
  charLength:   number;
  error?:       string;
}

// ─── Discord Context (built by contextBuilder) ────────────────────────────────

export interface DiscordContext {
  /** Current user message (trimmed) */
  currentMessage: string;
  /** Username / displayname of the message author */
  authorName:     string;
  /** Highest visible role names, e.g. ["Admin", "Member"] */
  authorRoles:    string[];
  /** Discord channel name */
  channelName:    string;
  /** If the message is a Discord reply: the original quoted message text + author */
  replyTo?: {
    authorName: string;
    content:    string;
  };
  /** Last N messages from the channel (oldest first, excluding bots and current msg) */
  channelHistory: ChannelHistoryEntry[];
  /** Knowledge loaded from data/knowledge/*.md files */
  knowledge:      string;
}

export interface ChannelHistoryEntry {
  authorName: string;
  content:    string;
  isBot:      boolean;
}
