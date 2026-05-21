import type { Client, Guild } from 'discord.js';
import { ChannelType, GuildScheduledEventStatus } from 'discord.js';
import { logger } from '../../utils/logger';
import {
  getGuildConfig, getChangelogConfig,
  listRules, listChangelogEntries,
  createRule, createChangelogEntry, createPublicEvent,
  publishChangelog,
  getDb,
} from '../../db/index';
import { markOutbound } from './index';

export interface ImportReport {
  rules:     { found: number; imported: number; skipped: number; note?: string };
  changelog: { found: number; imported: number; skipped: number; note?: string };
  events:    { found: number; imported: number; skipped: number; note?: string };
  errors:    string[];
}

export async function runInitialImport(client: Client, guildId: string, importedBy: string): Promise<ImportReport> {
  const report: ImportReport = {
    rules:     { found: 0, imported: 0, skipped: 0 },
    changelog: { found: 0, imported: 0, skipped: 0 },
    events:    { found: 0, imported: 0, skipped: 0 },
    errors:    [],
  };

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    report.errors.push('Guild nicht gefunden');
    return report;
  }

  await importRules(client, guild, guildId, importedBy, report).catch(err => {
    report.errors.push(`rules: ${(err as Error).message}`);
  });
  await importChangelog(client, guild, guildId, importedBy, report).catch(err => {
    report.errors.push(`changelog: ${(err as Error).message}`);
  });
  await importEvents(guild, guildId, importedBy, report).catch(err => {
    report.errors.push(`events: ${(err as Error).message}`);
  });

  logger.info(`[sync-import] Guild ${guildId} import: rules ${report.rules.imported}, changelog ${report.changelog.imported}, events ${report.events.imported}`);
  return report;
}

// ===== RULES =====
async function importRules(client: Client, guild: Guild, guildId: string, importedBy: string, report: ImportReport): Promise<void> {
  const cfg = getGuildConfig(guildId);
  if (!cfg?.rules_channel_id || !cfg.rules_message_id) {
    report.rules.note = 'rules_channel_id oder rules_message_id nicht konfiguriert — Import übersprungen.';
    return;
  }
  const existing = listRules(guildId);
  if (existing.length > 0) {
    report.rules.skipped = existing.length;
    report.rules.note = `${existing.length} Regeln existieren bereits — Import übersprungen. Lösche zuerst manuell, wenn du neu importieren willst.`;
    return;
  }

  const channel = await guild.channels.fetch(cfg.rules_channel_id).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    report.rules.note = 'Rules-Channel nicht zugreifbar.';
    return;
  }
  const msg = await channel.messages.fetch(cfg.rules_message_id).catch(() => null);
  if (!msg) {
    report.rules.note = 'Rules-Message nicht gefunden.';
    return;
  }

  // Parse each embed: title=category, fields = individual rules
  let sortOrder = 0;
  for (const embed of msg.embeds) {
    const category = (embed.title || 'general').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50);
    report.rules.found += embed.fields.length;

    for (const field of embed.fields) {
      try {
        const title = field.name.replace(/^[•*-]\s*\*?\*?/, '').replace(/\*\*$/, '').trim().slice(0, 200);
        const body  = field.value.trim().slice(0, 4000);
        if (!title || !body) continue;
        createRule({
          guild_id: guildId,
          category,
          title,
          body,
          sort_order: sortOrder++,
          public_visible: 1,
          created_by: importedBy,
        });
        report.rules.imported++;
      } catch (err) {
        report.errors.push(`rule-import: ${(err as Error).message}`);
      }
    }

    // Also parse description as a single "intro" rule if no fields
    if (embed.fields.length === 0 && embed.description) {
      report.rules.found++;
      try {
        createRule({
          guild_id: guildId,
          category,
          title: (embed.title || 'Regel').slice(0, 200),
          body: embed.description.trim().slice(0, 4000),
          sort_order: sortOrder++,
          public_visible: 1,
          created_by: importedBy,
        });
        report.rules.imported++;
      } catch (err) {
        report.errors.push(`rule-import: ${(err as Error).message}`);
      }
    }
  }
}

// ===== CHANGELOG =====
async function importChangelog(client: Client, guild: Guild, guildId: string, importedBy: string, report: ImportReport): Promise<void> {
  const cfg = getChangelogConfig(guildId);
  if (!cfg?.public_channel_id) {
    report.changelog.note = 'changelog public_channel_id nicht konfiguriert — Import übersprungen.';
    return;
  }
  const existing = listChangelogEntries(guildId);
  if (existing.length > 0) {
    report.changelog.skipped = existing.length;
    report.changelog.note = `${existing.length} Changelog-Einträge existieren bereits — Import übersprungen.`;
    return;
  }

  const channel = await guild.channels.fetch(cfg.public_channel_id).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    report.changelog.note = 'Changelog-Channel nicht zugreifbar.';
    return;
  }

  const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  if (!messages) {
    report.changelog.note = 'Konnte Changelog-Messages nicht laden.';
    return;
  }

  // Filter: only bot messages with embeds (likely changelog posts)
  const candidates = Array.from(messages.values())
    .filter(m => m.author.bot && m.embeds.length > 0)
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp); // oldest first for natural numbering

  report.changelog.found = candidates.length;

  for (const msg of candidates) {
    try {
      const embed = msg.embeds[0];
      const title = (embed.title || 'Update').slice(0, 200);
      // Reconstruct body from fields
      const bodyParts: string[] = [];
      if (embed.description) bodyParts.push(embed.description);
      for (const f of embed.fields) {
        bodyParts.push(`**${f.name}**\n${f.value}`);
      }
      const body = bodyParts.join('\n\n').slice(0, 8000) || 'Importiert von Discord.';
      const versionMatch = title.match(/v?(\d+\.\d+(?:\.\d+)?)/);
      const version = versionMatch ? versionMatch[1] : null;

      const created = createChangelogEntry({
        guild_id: guildId,
        title,
        body,
        category: 'server',
        version: version ?? undefined,
        status: 'published',
        public_visible: 1,
        created_by: importedBy,
      });
      // Set published_at and discord_message_id via publishChangelog
      publishChangelog(created.id, Math.floor(msg.createdTimestamp / 1000), msg.id);
      // mark outbound so we don't re-process this if a MessageUpdate comes in
      markOutbound(`message:${msg.id}`);
      report.changelog.imported++;
    } catch (err) {
      report.errors.push(`changelog-import: ${(err as Error).message}`);
    }
  }
}

// ===== EVENTS =====
async function importEvents(guild: Guild, guildId: string, importedBy: string, report: ImportReport): Promise<void> {
  const events = await guild.scheduledEvents.fetch().catch(() => null);
  if (!events) {
    report.events.note = 'Konnte Scheduled Events nicht laden.';
    return;
  }
  report.events.found = events.size;

  // Skip already-imported (with discord_event_id set)
  const existingIds = new Set<string>(
    (getDb().prepare('SELECT discord_event_id FROM public_events WHERE guild_id = ? AND discord_event_id IS NOT NULL').all(guildId) as Array<{ discord_event_id: string }>)
      .map(r => r.discord_event_id)
  );

  for (const ev of events.values()) {
    try {
      if (existingIds.has(ev.id)) {
        report.events.skipped++;
        continue;
      }
      const status = ev.status === GuildScheduledEventStatus.Active ? 'live'
        : ev.status === GuildScheduledEventStatus.Completed ? 'ended'
        : ev.status === GuildScheduledEventStatus.Canceled ? 'cancelled'
        : 'scheduled';

      const created = createPublicEvent({
        guild_id: guildId,
        title: ev.name.slice(0, 200),
        description: ev.description ? ev.description.slice(0, 4000) : null,
        event_type: 'community',
        starts_at: ev.scheduledStartTimestamp ? Math.floor(ev.scheduledStartTimestamp / 1000) : Math.floor(Date.now() / 1000),
        ends_at: ev.scheduledEndTimestamp ? Math.floor(ev.scheduledEndTimestamp / 1000) : null,
        status,
        discord_url: null,
        banner_url: ev.coverImageURL({ size: 1024 }) || null,
        public_visible: 1,
        created_by: importedBy,
      });
      getDb().prepare('UPDATE public_events SET discord_event_id = ? WHERE id = ?').run(ev.id, created.id);
      markOutbound(`event:${ev.id}`);
      report.events.imported++;
    } catch (err) {
      report.errors.push(`event-import: ${(err as Error).message}`);
    }
  }
}
