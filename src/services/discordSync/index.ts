import type { Client, TextChannel } from 'discord.js';
import {
  ChannelType,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventStatus,
} from 'discord.js';
import { logger } from '../../utils/logger';
import {
  listRules,
  listFaqItems,
  getChangelogEntry,
  getPublicAnnouncement,
  getPublicEvent,
  getWipeInfo,
  getServerPublicInfo,
  getGuildConfig,
  upsertGuildConfig,
  getChangelogConfig,
  getSetting,
  upsertSetting,
  getDb,
} from '../../db/index';
import { env } from '../../config/env';
import {
  buildRulesEmbeds,
  buildChangelogEmbed,
  buildAnnouncementEmbed,
  buildEventEmbed,
  buildFaqEmbeds,
  buildServerInfoEmbed,
  buildWipeInfoEmbed,
} from './embeds';

export interface SyncResult {
  success: boolean;
  messageId?: string;
  eventId?: string;
  error?: string;
}

// Re-entrancy guard: track messages we just wrote, so the corresponding
// MessageUpdate/EventUpdate event from Discord doesn't trigger a loop.
const recentOutboundWrites = new Map<string, number>();
const OUTBOUND_WINDOW_MS = 5_000;

export function markOutbound(key: string): void {
  recentOutboundWrites.set(key, Date.now());
  // Cleanup old entries
  for (const [k, ts] of recentOutboundWrites) {
    if (Date.now() - ts > OUTBOUND_WINDOW_MS * 4) recentOutboundWrites.delete(k);
  }
}

export function isRecentOutbound(key: string): boolean {
  const ts = recentOutboundWrites.get(key);
  return ts != null && Date.now() - ts < OUTBOUND_WINDOW_MS;
}

async function fetchTextChannel(
  client: Client,
  channelId: string | null | undefined,
): Promise<TextChannel | null> {
  if (!channelId) return null;
  try {
    const ch = await client.channels.fetch(channelId);
    if (!ch || ch.type !== ChannelType.GuildText) return null;
    return ch as TextChannel;
  } catch (err) {
    logger.warn(`[sync] channel fetch failed for ${channelId}: ${(err as Error).message}`);
    return null;
  }
}

// ===== RULES =====
export async function pushRulesToDiscord(client: Client, guildId: string): Promise<SyncResult> {
  try {
    const config = getGuildConfig(guildId);
    if (!config?.rules_channel_id) return { success: false, error: 'rules_channel_id not configured' };
    const channel = await fetchTextChannel(client, config.rules_channel_id);
    if (!channel) return { success: false, error: 'rules channel not accessible' };

    const rules       = listRules(guildId, { publicOnly: true });
    const lastUpdated = rules.reduce((max, r) => Math.max(max, r.updated_at), 0) || null;
    const embeds      = buildRulesEmbeds(rules, {
      bannerUrl:   env.RULES_BANNER_URL || null,
      lastUpdated,
    });

    if (config.rules_message_id) {
      try {
        const msg = await channel.messages.fetch(config.rules_message_id);
        await msg.edit({ embeds });
        markOutbound(`message:${msg.id}`);
        return { success: true, messageId: msg.id };
      } catch {
        // Message was deleted — fall through and post a new one
      }
    }
    const sent = await channel.send({ embeds });
    markOutbound(`message:${sent.id}`);
    upsertGuildConfig(guildId, { rules_message_id: sent.id });
    return { success: true, messageId: sent.id };
  } catch (err) {
    logger.error('[sync] pushRulesToDiscord error:', err);
    return { success: false, error: (err as Error).message };
  }
}

// ===== CHANGELOG =====
export async function pushChangelogToDiscord(client: Client, entryId: number): Promise<SyncResult> {
  try {
    const entry = getChangelogEntry(entryId);
    if (!entry) return { success: false, error: 'entry not found' };
    if (entry.status !== 'published' || entry.public_visible !== 1) {
      // Not published — skip; if there's an existing discord_message_id, leave it alone
      return { success: true };
    }
    const config = getChangelogConfig(entry.guild_id);
    if (!config?.public_channel_id) return { success: false, error: 'changelog public_channel_id not configured' };
    const channel = await fetchTextChannel(client, config.public_channel_id);
    if (!channel) return { success: false, error: 'changelog channel not accessible' };

    const embed = buildChangelogEmbed(entry);

    if (entry.discord_message_id) {
      try {
        const msg = await channel.messages.fetch(entry.discord_message_id);
        await msg.edit({ embeds: [embed] });
        markOutbound(`message:${msg.id}`);
        return { success: true, messageId: msg.id };
      } catch { /* fall through */ }
    }
    const sent = await channel.send({ embeds: [embed] });
    markOutbound(`message:${sent.id}`);
    getDb()
      .prepare('UPDATE changelog_entries SET discord_message_id = ? WHERE id = ?')
      .run(sent.id, entryId);
    return { success: true, messageId: sent.id };
  } catch (err) {
    logger.error('[sync] pushChangelogToDiscord error:', err);
    return { success: false, error: (err as Error).message };
  }
}

// ===== ANNOUNCEMENTS =====
export async function pushAnnouncementToDiscord(client: Client, announcementId: number): Promise<SyncResult> {
  try {
    const a = getPublicAnnouncement(announcementId);
    if (!a) {
      // Likely deleted — nothing to push
      return { success: true };
    }
    const channelId = getSetting(a.guild_id, 'channel', 'announcements_channel_id')?.setting_value;
    if (!channelId) return { success: false, error: 'announcements_channel_id not configured' };
    const channel = await fetchTextChannel(client, channelId);
    if (!channel) return { success: false, error: 'announcements channel not accessible' };

    const nowSec     = Math.floor(Date.now() / 1000);
    const isActive   =
      a.active === 1 &&
      a.public_visible === 1 &&
      a.starts_at <= nowSec &&
      (a.ends_at == null || a.ends_at >= nowSec);
    const existingId = (a as { discord_message_id?: string | null }).discord_message_id;

    if (!isActive) {
      // Should not be in Discord. If we have an ID, delete it.
      if (existingId) {
        try {
          const msg = await channel.messages.fetch(existingId);
          await msg.delete();
          markOutbound(`message:${existingId}`);
        } catch { /* ignore */ }
        getDb()
          .prepare('UPDATE public_announcements SET discord_message_id = NULL WHERE id = ?')
          .run(announcementId);
      }
      return { success: true };
    }

    const embed = buildAnnouncementEmbed(a);
    if (existingId) {
      try {
        const msg = await channel.messages.fetch(existingId);
        await msg.edit({ embeds: [embed] });
        markOutbound(`message:${msg.id}`);
        if (a.show_as_banner === 1 && !msg.pinned) await msg.pin().catch(() => {});
        if (a.show_as_banner === 0 && msg.pinned)  await msg.unpin().catch(() => {});
        return { success: true, messageId: msg.id };
      } catch { /* fall through */ }
    }
    const sent = await channel.send({ embeds: [embed] });
    markOutbound(`message:${sent.id}`);
    if (a.show_as_banner === 1) await sent.pin().catch(() => {});
    getDb()
      .prepare('UPDATE public_announcements SET discord_message_id = ? WHERE id = ?')
      .run(sent.id, announcementId);
    return { success: true, messageId: sent.id };
  } catch (err) {
    logger.error('[sync] pushAnnouncementToDiscord error:', err);
    return { success: false, error: (err as Error).message };
  }
}

// ===== EVENTS (Discord Scheduled Events) =====
export async function pushEventToDiscord(client: Client, eventId: number): Promise<SyncResult> {
  try {
    const ev = getPublicEvent(eventId);
    if (!ev) return { success: true };
    const guild = client.guilds.cache.get(ev.guild_id);
    if (!guild) return { success: false, error: 'guild not found' };
    const discordEventId = (ev as { discord_event_id?: string | null }).discord_event_id;

    // If cancelled — cancel/delete the Discord event
    if (ev.status === 'cancelled') {
      if (discordEventId) {
        try {
          const dEv = await guild.scheduledEvents.fetch(discordEventId);
          if (dEv && dEv.status === GuildScheduledEventStatus.Scheduled) {
            await guild.scheduledEvents.delete(discordEventId);
            markOutbound(`event:${discordEventId}`);
          }
        } catch { /* ignore */ }
        getDb()
          .prepare('UPDATE public_events SET discord_event_id = NULL WHERE id = ?')
          .run(eventId);
      }
      return { success: true };
    }
    if (ev.public_visible !== 1) return { success: true };

    // Discord requires either entityType:External + entityMetadata.location OR voice channel
    const startsAt = new Date(ev.starts_at * 1000);
    const endsAt   = ev.ends_at
      ? new Date(ev.ends_at * 1000)
      : new Date(ev.starts_at * 1000 + 3_600_000);

    const payload = {
      name:               ev.title.slice(0, 100),
      description:        ev.description ? ev.description.slice(0, 1000) : undefined,
      scheduledStartTime: startsAt,
      scheduledEndTime:   endsAt,
      privacyLevel:       GuildScheduledEventPrivacyLevel.GuildOnly,
      entityType:         GuildScheduledEventEntityType.External as const,
      entityMetadata:     { location: ev.discord_url || 'SCUM Server' },
      image:              ev.banner_url ?? undefined,
    };

    if (discordEventId) {
      try {
        const dEv = await guild.scheduledEvents.edit(discordEventId, payload);
        markOutbound(`event:${dEv.id}`);
        return { success: true, eventId: dEv.id };
      } catch { /* fall through to create */ }
    }
    const created = await guild.scheduledEvents.create(payload);
    markOutbound(`event:${created.id}`);
    getDb()
      .prepare('UPDATE public_events SET discord_event_id = ? WHERE id = ?')
      .run(created.id, eventId);
    return { success: true, eventId: created.id };
  } catch (err) {
    logger.error('[sync] pushEventToDiscord error:', err);
    return { success: false, error: (err as Error).message };
  }
}

export async function deleteEventFromDiscord(
  client: Client,
  discordEventId: string,
  guildId: string,
): Promise<SyncResult> {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return { success: false, error: 'guild not found' };
    try {
      await guild.scheduledEvents.delete(discordEventId);
      markOutbound(`event:${discordEventId}`);
    } catch { /* ignore — already gone */ }
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ===== FAQ =====
export async function pushFaqToDiscord(client: Client, guildId: string): Promise<SyncResult> {
  try {
    const channelId = getSetting(guildId, 'channel', 'faq_channel_id')?.setting_value;
    if (!channelId) return { success: false, error: 'faq_channel_id not configured' };
    const channel = await fetchTextChannel(client, channelId);
    if (!channel) return { success: false, error: 'faq channel not accessible' };

    const items  = listFaqItems(guildId, { publicOnly: true });
    const embeds = buildFaqEmbeds(items);

    const existingId = getSetting(guildId, 'dashboard', 'faq_message_id')?.setting_value;
    if (existingId) {
      try {
        const msg = await channel.messages.fetch(existingId);
        await msg.edit({ embeds });
        markOutbound(`message:${msg.id}`);
        return { success: true, messageId: msg.id };
      } catch { /* fall through */ }
    }
    const sent = await channel.send({ embeds });
    markOutbound(`message:${sent.id}`);
    upsertSetting({ guildId, category: 'dashboard', key: 'faq_message_id', value: sent.id, isSecret: 0, updatedBy: null });
    return { success: true, messageId: sent.id };
  } catch (err) {
    logger.error('[sync] pushFaqToDiscord error:', err);
    return { success: false, error: (err as Error).message };
  }
}

// ===== CHANGELOG DELETE =====
export async function deleteChangelogFromDiscord(client: Client, guildId: string, discordMessageId: string): Promise<SyncResult> {
  try {
    const config = getChangelogConfig(guildId);
    if (!config?.public_channel_id) return { success: true };
    const channel = await fetchTextChannel(client, config.public_channel_id);
    if (!channel) return { success: true };
    try {
      const msg = await channel.messages.fetch(discordMessageId);
      await msg.delete();
      markOutbound(`message:${discordMessageId}`);
    } catch { /* already gone */ }
    return { success: true };
  } catch (err) {
    logger.error('[sync] deleteChangelogFromDiscord error:', err);
    return { success: false, error: (err as Error).message };
  }
}

// ===== ANNOUNCEMENT DELETE =====
export async function deleteAnnouncementFromDiscord(client: Client, guildId: string, discordMessageId: string): Promise<SyncResult> {
  try {
    const channelId = getSetting(guildId, 'channel', 'announcements_channel_id')?.setting_value;
    if (!channelId) return { success: true };
    const channel = await fetchTextChannel(client, channelId);
    if (!channel) return { success: true };
    try {
      const msg = await channel.messages.fetch(discordMessageId);
      await msg.delete();
      markOutbound(`message:${discordMessageId}`);
    } catch { /* already gone */ }
    return { success: true };
  } catch (err) {
    logger.error('[sync] deleteAnnouncementFromDiscord error:', err);
    return { success: false, error: (err as Error).message };
  }
}

// ===== SERVER-INFO + WIPE =====
export async function pushServerInfoToDiscord(client: Client, guildId: string): Promise<SyncResult> {
  try {
    const channelId = getSetting(guildId, 'channel', 'server_info_channel_id')?.setting_value;
    if (!channelId) return { success: false, error: 'server_info_channel_id not configured' };
    const channel = await fetchTextChannel(client, channelId);
    if (!channel) return { success: false, error: 'server-info channel not accessible' };

    const info = getServerPublicInfo(guildId);
    const wipe = getWipeInfo(guildId);
    if (!info && !wipe) return { success: true }; // nothing to publish

    const embed = info
      ? buildServerInfoEmbed(info, wipe)
      : wipe
        ? buildWipeInfoEmbed(wipe)
        : null;
    if (!embed) return { success: true };

    const existingId = getSetting(guildId, 'dashboard', 'server_info_message_id')?.setting_value;
    if (existingId) {
      try {
        const msg = await channel.messages.fetch(existingId);
        await msg.edit({ embeds: [embed] });
        markOutbound(`message:${msg.id}`);
        return { success: true, messageId: msg.id };
      } catch { /* fall through */ }
    }
    const sent = await channel.send({ embeds: [embed] });
    markOutbound(`message:${sent.id}`);
    upsertSetting({ guildId, category: 'dashboard', key: 'server_info_message_id', value: sent.id, isSecret: 0, updatedBy: null });
    return { success: true, messageId: sent.id };
  } catch (err) {
    logger.error('[sync] pushServerInfoToDiscord error:', err);
    return { success: false, error: (err as Error).message };
  }
}
