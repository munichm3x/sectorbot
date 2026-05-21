import { EmbedBuilder, type APIEmbed } from 'discord.js';
import type { RuleEntry, PublicEvent, ChangelogEntry, PublicAnnouncement, FaqItem, WipeInfo, ServerPublicInfo } from '../../types';

export const COLOR_ACCENT  = 0xb5162f;
export const COLOR_ONLINE  = 0x3bca6e;
export const COLOR_WARN    = 0xe8981a;
export const COLOR_OFFLINE = 0xe05252;
export const COLOR_INFO    = 0x4a9eff;

const CATEGORY_LABELS: Record<string, string> = {
  general:           'Allgemeines Verhalten',
  teams:             'Teams & Gruppierungen',
  solo:              'Einzelkämpfer / Orange Solo',
  pvp:               'PvP-Regeln',
  vehicles:          'Fahrzeuge & Limits',
  bases:             'Base-Regeln',
  permadeath:        'Permadeath',
  whitelist:         'Whitelist & Verifizierung',
  'discord-support': 'Discord & Support',
  events:            'Events',
};

const CHANGELOG_CATEGORY_LABELS: Record<string, string> = {
  server: 'Server', discord: 'Discord', rules: 'Regeln', events: 'Events', bot: 'Bot',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  pvp:      'PvP Event',
  raid:     'Base Raid',
  solo:     'Solo Challenge',
  airfield: 'Airfield Control',
  bunker:   'Bunker Run',
  trader:   'Trader Event',
  meeting:  'Community Meeting',
  wipe:     'Wipe Event',
  community:'Community',
};

const ANNOUNCEMENT_TYPE_COLORS: Record<string, number> = {
  info:        COLOR_INFO,
  maintenance: COLOR_WARN,
  warning:     COLOR_OFFLINE,
  event:       COLOR_ACCENT,
  whitelist:   COLOR_ONLINE,
  rules:       COLOR_ACCENT,
};

const ANNOUNCEMENT_TYPE_LABELS: Record<string, string> = {
  info:        'INFO',
  maintenance: 'WARTUNG',
  warning:     'WARNUNG',
  event:       'EVENT',
  whitelist:   'WHITELIST',
  rules:       'REGELÄNDERUNG',
};

const WIPE_TYPE_LABELS: Record<string, string> = {
  full:      'Full Wipe',
  partial:   'Partial Wipe',
  economy:   'Economy Wipe',
  character: 'Character Wipe',
};

/**
 * Build rules embeds. Returns ONE main embed with all rules as fields, grouped by category.
 * Discord allows max 25 fields per embed; we'll cap at that. If more, additional embeds follow.
 * The first embed has banner image. Last embed has footer with timestamp.
 */
export function buildRulesEmbeds(
  rules: RuleEntry[],
  opts: { bannerUrl?: string | null; lastUpdated?: number | null } = {},
): APIEmbed[] {
  if (rules.length === 0) {
    const e = new EmbedBuilder()
      .setColor(COLOR_ACCENT)
      .setTitle('Sektor-13 Regelwerk')
      .setDescription('Noch keine Regeln konfiguriert.');
    if (opts.bannerUrl) e.setImage(opts.bannerUrl);
    return [e.toJSON()];
  }

  // Group by category, sort by sort_order within category
  const grouped = new Map<string, RuleEntry[]>();
  for (const r of rules) {
    if (!grouped.has(r.category)) grouped.set(r.category, []);
    grouped.get(r.category)!.push(r);
  }
  for (const list of grouped.values()) list.sort((a, b) => a.sort_order - b.sort_order);

  // Build fields per category — each field is one rule (title + body in value)
  // Discord field name max 256, value max 1024
  const fields: Array<{ name: string; value: string; inline: boolean }> = [];
  for (const [cat, list] of grouped) {
    const catLabel = CATEGORY_LABELS[cat] ?? cat;
    fields.push({ name: `**${catLabel}**`, value: '​', inline: false });
    for (const rule of list) {
      const value = truncate(rule.body || '—', 1024);
      const name  = truncate(`• ${rule.title}`, 256);
      fields.push({ name, value, inline: false });
    }
  }

  // Split into multiple embeds if >25 fields
  const embeds: APIEmbed[] = [];
  const FIELD_LIMIT = 25;
  let chunk   = fields.slice();
  let isFirst = true;
  while (chunk.length > 0) {
    const slice = chunk.slice(0, FIELD_LIMIT);
    chunk = chunk.slice(FIELD_LIMIT);
    const e = new EmbedBuilder()
      .setColor(COLOR_ACCENT)
      .addFields(slice);
    if (isFirst) {
      e.setTitle('Sektor-13 Regelwerk');
      e.setDescription('Verbindliche Regeln für Server und Discord. Bei Fragen: Ticket erstellen.');
      if (opts.bannerUrl) e.setImage(opts.bannerUrl);
      isFirst = false;
    }
    if (chunk.length === 0 && opts.lastUpdated) {
      e.setFooter({ text: 'Zuletzt aktualisiert' }).setTimestamp(opts.lastUpdated * 1000);
    }
    embeds.push(e.toJSON());
  }
  return embeds.slice(0, 10); // Discord max 10 embeds per message
}

export function buildChangelogEmbed(entry: ChangelogEntry): APIEmbed {
  const e = new EmbedBuilder()
    .setColor(COLOR_ACCENT)
    .setTitle(entry.version ? `${entry.title} · v${entry.version}` : entry.title)
    .setDescription(truncate(entry.body, 4000))
    .setFooter({ text: `Update · ${CHANGELOG_CATEGORY_LABELS[entry.category] ?? entry.category}` });
  if (entry.published_at) e.setTimestamp(entry.published_at * 1000);
  return e.toJSON();
}

export function buildAnnouncementEmbed(a: PublicAnnouncement): APIEmbed {
  const color = ANNOUNCEMENT_TYPE_COLORS[a.announcement_type] ?? COLOR_INFO;
  const label = ANNOUNCEMENT_TYPE_LABELS[a.announcement_type] ?? 'HINWEIS';
  const e = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${label} · ${a.title}`)
    .setDescription(truncate(a.body, 4000));
  const footerParts: string[] = [];
  if (a.priority > 0) footerParts.push(`Priorität ${a.priority}`);
  if (a.ends_at) footerParts.push(`Bis ${formatGermanDate(a.ends_at)}`);
  if (footerParts.length > 0) e.setFooter({ text: footerParts.join(' · ') });
  if (a.starts_at) e.setTimestamp(a.starts_at * 1000);
  return e.toJSON();
}

export function buildEventEmbed(ev: PublicEvent): APIEmbed {
  const e = new EmbedBuilder()
    .setColor(ev.status === 'live' ? COLOR_ONLINE : ev.status === 'cancelled' ? COLOR_OFFLINE : COLOR_ACCENT)
    .setTitle(ev.title)
    .addFields(
      { name: 'Typ',    value: EVENT_TYPE_LABELS[ev.event_type] ?? ev.event_type, inline: true },
      { name: 'Start',  value: formatGermanDate(ev.starts_at),                    inline: true },
      { name: 'Status', value: ev.status,                                          inline: true },
    );
  if (ev.description) e.setDescription(truncate(ev.description, 4000));
  if (ev.ends_at)     e.addFields({ name: 'Ende', value: formatGermanDate(ev.ends_at), inline: true });
  if (ev.banner_url)  e.setImage(ev.banner_url);
  if (ev.discord_url) e.setURL(ev.discord_url);
  return e.toJSON();
}

export function buildFaqEmbeds(items: FaqItem[]): APIEmbed[] {
  if (items.length === 0) {
    return [
      new EmbedBuilder()
        .setColor(COLOR_ACCENT)
        .setTitle('FAQ')
        .setDescription('Noch keine FAQ-Einträge.')
        .toJSON(),
    ];
  }

  // Group by category. Each category = one embed with question/answer fields.
  const grouped = new Map<string, FaqItem[]>();
  for (const i of items) {
    if (!grouped.has(i.category)) grouped.set(i.category, []);
    grouped.get(i.category)!.push(i);
  }
  for (const list of grouped.values()) list.sort((a, b) => a.sort_order - b.sort_order);

  const embeds: APIEmbed[] = [];
  let isFirst = true;
  for (const [cat, list] of grouped) {
    const fields = list.slice(0, 25).map(i => ({
      name:   truncate(`❓ ${i.question}`, 256),
      value:  truncate(i.answer, 1024),
      inline: false,
    }));
    const e = new EmbedBuilder()
      .setColor(COLOR_ACCENT)
      .setTitle(isFirst ? `FAQ · ${cat}` : cat)
      .addFields(fields);
    if (isFirst) {
      e.setDescription('Häufig gestellte Fragen. Bei weiteren Fragen: Ticket erstellen.');
      isFirst = false;
    }
    embeds.push(e.toJSON());
    if (embeds.length >= 10) break;
  }
  return embeds;
}

export function buildServerInfoEmbed(info: ServerPublicInfo, wipe: WipeInfo | null): APIEmbed {
  const e = new EmbedBuilder()
    .setColor(COLOR_ACCENT)
    .setTitle(info.server_name || 'SCUM Server-Information');
  if (info.description) e.setDescription(truncate(info.description, 2000));

  const fields: Array<{ name: string; value: string; inline: boolean }> = [];
  if (info.game_mode)      fields.push({ name: 'Spielmodus',  value: info.game_mode,               inline: true  });
  if (info.max_team_size != null) fields.push({ name: 'Max. Team', value: String(info.max_team_size), inline: true  });
  if (info.solo_color)     fields.push({ name: 'Solo-Farbe',  value: info.solo_color,               inline: true  });
  if (info.loot_rate)      fields.push({ name: 'Loot Rate',   value: info.loot_rate,                inline: true  });
  if (info.map_region)     fields.push({ name: 'Map / Region',value: info.map_region,               inline: true  });
  if (info.restart_times)  fields.push({ name: 'Restart',     value: info.restart_times,            inline: true  });
  if (info.vehicle_limit)  fields.push({ name: 'Fahrzeug-Limit', value: info.vehicle_limit,         inline: false });
  if (info.base_limit)     fields.push({ name: 'Base-Limit',  value: info.base_limit,               inline: false });
  if (info.safezones  != null) fields.push({ name: 'Safezones',  value: info.safezones  ? 'Aktiv' : 'Keine',   inline: true });
  if (info.permadeath != null) fields.push({ name: 'Permadeath', value: info.permadeath ? 'Aktiv' : 'Inaktiv', inline: true });
  if (info.join_hint)  fields.push({ name: 'Join', value: info.join_hint, inline: false });

  if (wipe && wipe.public_visible === 1) {
    if (wipe.current_season || wipe.season_name) {
      const seasonText = [
        wipe.current_season ? `Season ${wipe.current_season}` : null,
        wipe.season_name ?? null,
      ].filter(Boolean).join(' — ');
      if (seasonText) fields.push({ name: 'Aktuelle Season', value: seasonText, inline: false });
    }
    if (wipe.last_wipe_at) {
      fields.push({
        name: 'Letzter Wipe',
        value: `${formatGermanDate(wipe.last_wipe_at)}${wipe.last_wipe_type ? ` (${WIPE_TYPE_LABELS[wipe.last_wipe_type] ?? wipe.last_wipe_type})` : ''}`,
        inline: true,
      });
    }
    if (wipe.next_wipe_at) {
      fields.push({
        name: 'Nächster Wipe',
        value: `${formatGermanDate(wipe.next_wipe_at)}${wipe.next_wipe_type ? ` (${WIPE_TYPE_LABELS[wipe.next_wipe_type] ?? wipe.next_wipe_type})` : ''}`,
        inline: true,
      });
    }
    if (wipe.notes) fields.push({ name: 'Wipe-Notizen', value: truncate(wipe.notes, 1024), inline: false });
  }

  if (fields.length > 0) e.addFields(fields.slice(0, 25));
  return e.toJSON();
}

export function buildWipeInfoEmbed(wipe: WipeInfo): APIEmbed {
  const e = new EmbedBuilder()
    .setColor(COLOR_ACCENT)
    .setTitle('Season & Wipe-Info');
  const fields: Array<{ name: string; value: string; inline: boolean }> = [];
  if (wipe.current_season) fields.push({ name: 'Season', value: String(wipe.current_season), inline: true });
  if (wipe.season_name)    fields.push({ name: 'Name',   value: wipe.season_name,             inline: true });
  if (wipe.last_wipe_at) {
    fields.push({
      name: 'Letzter Wipe',
      value: `${formatGermanDate(wipe.last_wipe_at)}${wipe.last_wipe_type ? ` (${WIPE_TYPE_LABELS[wipe.last_wipe_type] ?? wipe.last_wipe_type})` : ''}`,
      inline: true,
    });
  }
  if (wipe.next_wipe_at) {
    fields.push({
      name: 'Nächster Wipe',
      value: `${formatGermanDate(wipe.next_wipe_at)}${wipe.next_wipe_type ? ` (${WIPE_TYPE_LABELS[wipe.next_wipe_type] ?? wipe.next_wipe_type})` : ''}`,
      inline: true,
    });
  }
  if (wipe.notes) fields.push({ name: 'Notizen', value: truncate(wipe.notes, 1024), inline: false });
  if (fields.length > 0) e.addFields(fields);
  if (wipe.updated_at) e.setTimestamp(wipe.updated_at * 1000);
  return e.toJSON();
}

function truncate(s: string, max: number): string {
  if (!s) return '';
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

function formatGermanDate(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
