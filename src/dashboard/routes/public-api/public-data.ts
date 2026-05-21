import type { GuildMember } from 'discord.js';
import type { StatusHistoryRow } from '../../../analytics/analytics.db';
import type { GuildConfig, ScumStatusConfig, TicketCategoryConfig, RuleEntry, PublicEvent, ChangelogEntry, PublicAnnouncement, FaqItem, WipeInfo, ServerPublicInfo } from '../../../types';

export interface PublicStatusPoint {
  online: boolean;
  playersOnline: number | null;
  maxPlayers: number | null;
  ping: number | null;
  checkedAt: number;
}

export interface PublicRuleCategory {
  id: string;
  title: string;
  rules: string[];
}

export interface PublicRulesPayload {
  lastUpdated: number | null;
  discordUrl: string | null;
  categories: PublicRuleCategory[];
}

export interface PublicEmptyContentPayload {
  events: [];
  announcements: [];
  changelog: [];
  faq: [];
}

export function sanitizeStatusHistory(history: StatusHistoryRow[]): PublicStatusPoint[] {
  return history.map(row => ({
    online: row.online === 1,
    playersOnline: row.players_online,
    maxPlayers: row.max_players,
    ping: row.ping,
    checkedAt: row.checked_at,
  }));
}

export function buildEmptyContentPayload(): PublicEmptyContentPayload {
  return {
    events: [],
    announcements: [],
    changelog: [],
    faq: [],
  };
}

export function discordMessageUrl(guildId: string, channelId: string | null | undefined, messageId?: string | null): string | null {
  if (!channelId) return null;
  if (!messageId) return `https://discord.com/channels/${encodeURIComponent(guildId)}/${encodeURIComponent(channelId)}`;
  return `https://discord.com/channels/${encodeURIComponent(guildId)}/${encodeURIComponent(channelId)}/${encodeURIComponent(messageId)}`;
}

const CATEGORY_LABELS: Record<string, string> = {
  general: 'Allgemeines Verhalten',
  teams: 'Teams & Gruppierungen',
  solo: 'Einzelkämpfer / Orange Solo',
  pvp: 'PvP-Regeln',
  vehicles: 'Fahrzeuge & Limits',
  bases: 'Base-Regeln',
  permadeath: 'Permadeath',
  'discord-support': 'Discord & Support',
  whitelist: 'Whitelist & Verifizierung',
  events: 'Events',
};

const FALLBACK_RULES: PublicRuleCategory[] = [
  {
    id: 'general',
    title: 'Allgemeines Verhalten',
    rules: [
      'Respektvoller Umgang mit allen Spielern ist Pflicht. Beleidigungen, toxisches Verhalten, Rassismus, Sexismus oder gezielte Provokationen sind verboten.',
      'Konflikte werden sachlich geklärt oder dem Team gemeldet.',
      'Cheats, Hacks, Exploits, Duping, Bugusing oder jede Form von Manipulation sind strengstens verboten.',
      'Offensichtliche Spielfehler müssen dem Team gemeldet werden.',
    ],
  },
  {
    id: 'teams',
    title: 'Teams & Gruppierungen',
    rules: [
      'Ein Team darf aus maximal 4 Spielern bestehen und muss eine gemeinsame Armbandfarbe jederzeit sichtbar tragen.',
      'Pro Team erlaubt: 1 Base und 1 gesetzte Flagge als offizielle Hauptbase.',
      'Dauerhafte Allianzen, Massenteams oder versteckte Kooperationen zwischen Teams sind verboten.',
    ],
  },
  {
    id: 'solo',
    title: 'Einzelkämpfer / Orange Solo',
    rules: [
      'Die Farbe Orange ist ausschließlich Einzelkämpfern vorbehalten.',
      'Orange Solo bedeutet keine festen Allianzen oder Gruppierungen.',
      'Einzelkämpfer dürfen eigene Flagge, eigene Base und Fahrzeuge inklusive Flugzeuge und Boote besitzen.',
      'Eine sichtbare orange Armbinde muss jederzeit getragen werden.',
    ],
  },
  {
    id: 'pvp',
    title: 'PvP-Regeln',
    rules: [
      'PvP ist auf der gesamten Insel jederzeit erlaubt.',
      'Es existieren keine Safezones.',
      'Combat Logging, Streamsniping, Abuse-Verhalten und das Umgehen von Spielmechaniken sind verboten.',
    ],
  },
  {
    id: 'vehicles',
    title: 'Fahrzeuge & Limits',
    rules: [
      'Pro Spieler sind 1 Fahrzeug und 1 Motorrad erlaubt.',
      'Pro Base sind 1 Flugzeug und 2 Boote erlaubt.',
      'Das absichtliche Verstecken oder Horten über dem erlaubten Limit ist untersagt.',
    ],
  },
  {
    id: 'bases',
    title: 'Base-Regeln',
    rules: [
      'Basen müssen regelkonform gebaut sein.',
      'Glitch-Building, unraidbare Konstruktionen und das Blockieren wichtiger Zugänge sind untersagt.',
    ],
  },
  {
    id: 'permadeath',
    title: 'Permadeath',
    rules: [
      'Bei -10.000 Fame Points tritt permanenter Charaktertod ein.',
      'Der Charakter gilt als verloren und muss vollständig neu erstellt werden.',
      'Eine Wiederherstellung durch das Team erfolgt nicht.',
    ],
  },
  {
    id: 'discord-support',
    title: 'Discord & Support',
    rules: [
      'Spam, Werbung, unnötige Pings, NSFW-Inhalte und störendes Verhalten sind verboten.',
      'Support erfolgt ausschließlich über das Ticket-System.',
      'Das Team behält sich das letzte Entscheidungsrecht vor.',
      'Regeländerungen gelten ab Veröffentlichung automatisch.',
    ],
  },
];

export function buildRulesPayload(config?: GuildConfig | null, dbRules?: RuleEntry[]): PublicRulesPayload {
  if (dbRules && dbRules.length > 0) {
    const grouped = new Map<string, RuleEntry[]>();
    for (const rule of dbRules) {
      if (!grouped.has(rule.category)) grouped.set(rule.category, []);
      grouped.get(rule.category)!.push(rule);
    }
    const categories: PublicRuleCategory[] = Array.from(grouped.entries()).map(([cat, entries]) => ({
      id: cat,
      title: CATEGORY_LABELS[cat] ?? (cat.charAt(0).toUpperCase() + cat.slice(1)),
      rules: entries
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
        .map(r => r.body && r.body.trim().length > 0 ? r.body : r.title),
    }));
    const lastUpdated = dbRules.reduce<number | null>((max, r) => max === null ? r.updated_at : Math.max(max, r.updated_at), null);
    return {
      lastUpdated,
      discordUrl: config ? discordMessageUrl(config.guild_id, config.rules_channel_id, config.rules_message_id) : null,
      categories,
    };
  }
  return {
    lastUpdated: config?.updated_at ?? null,
    discordUrl: config ? discordMessageUrl(config.guild_id, config.rules_channel_id, config.rules_message_id) : null,
    categories: FALLBACK_RULES,
  };
}

export function buildEventsPayload(events: PublicEvent[]): Array<{
  id: number;
  title: string;
  description: string | null;
  type: string;
  startsAt: number;
  endsAt: number | null;
  status: string;
  discordUrl: string | null;
  bannerUrl: string | null;
}> {
  return events.map(e => ({
    id: e.id,
    title: e.title,
    description: e.description,
    type: e.event_type,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    status: e.status,
    discordUrl: e.discord_url,
    bannerUrl: e.banner_url,
  }));
}

export function buildChangelogPayload(entries: ChangelogEntry[]): Array<{
  id: number;
  title: string;
  body: string;
  category: string;
  version: string | null;
  publishedAt: number | null;
  discordMessageId: string | null;
}> {
  return entries.map(c => ({
    id: c.id,
    title: c.title,
    body: c.body,
    category: c.category,
    version: c.version,
    publishedAt: c.published_at,
    discordMessageId: c.discord_message_id,
  }));
}

export function buildAnnouncementsPayload(announcements: PublicAnnouncement[]): Array<{
  id: number;
  title: string;
  body: string;
  type: string;
  priority: number;
  startsAt: number;
  endsAt: number | null;
  showAsBanner: boolean;
}> {
  return announcements.map(a => ({
    id: a.id,
    title: a.title,
    body: a.body,
    type: a.announcement_type,
    priority: a.priority,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    showAsBanner: a.show_as_banner === 1,
  }));
}

export function buildFaqPayload(items: FaqItem[]): Array<{
  category: string;
  items: Array<{ id: number; question: string; answer: string; sortOrder: number }>;
}> {
  const grouped = new Map<string, FaqItem[]>();
  for (const item of items) {
    if (!grouped.has(item.category)) grouped.set(item.category, []);
    grouped.get(item.category)!.push(item);
  }
  return Array.from(grouped.entries())
    .map(([category, list]) => ({
      category,
      items: list
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(i => ({ id: i.id, question: i.question, answer: i.answer, sortOrder: i.sort_order })),
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

export function buildWipeInfoPayload(wipe: WipeInfo | null): null | {
  currentSeason: number | null;
  seasonName: string | null;
  lastWipeAt: number | null;
  lastWipeType: string | null;
  nextWipeAt: number | null;
  nextWipeType: string | null;
  notes: string | null;
} {
  if (!wipe || wipe.public_visible !== 1) return null;
  return {
    currentSeason: wipe.current_season,
    seasonName: wipe.season_name,
    lastWipeAt: wipe.last_wipe_at,
    lastWipeType: wipe.last_wipe_type,
    nextWipeAt: wipe.next_wipe_at,
    nextWipeType: wipe.next_wipe_type,
    notes: wipe.notes,
  };
}

export function buildServerPublicInfoPayload(info: ServerPublicInfo | null): null | {
  serverName: string | null;
  description: string | null;
  gameMode: string | null;
  maxTeamSize: number | null;
  soloColor: string | null;
  lootRate: string | null;
  safezones: boolean | null;
  permadeath: boolean | null;
  vehicleLimit: string | null;
  baseLimit: string | null;
  restartTimes: string | null;
  mapRegion: string | null;
  joinHint: string | null;
} {
  if (!info) return null;
  return {
    serverName: info.server_name,
    description: info.description,
    gameMode: info.game_mode,
    maxTeamSize: info.max_team_size,
    soloColor: info.solo_color,
    lootRate: info.loot_rate,
    safezones: info.safezones == null ? null : info.safezones === 1,
    permadeath: info.permadeath == null ? null : info.permadeath === 1,
    vehicleLimit: info.vehicle_limit,
    baseLimit: info.base_limit,
    restartTimes: info.restart_times,
    mapRegion: info.map_region,
    joinHint: info.join_hint,
  };
}

export function buildServerConfigCards(scumConfig?: ScumStatusConfig | null): Array<{ label: string; value: string; state?: string }> {
  const cards = [
    { label: 'Spielmodus', value: 'PvP', state: 'danger' },
    { label: 'Max Team Size', value: '4 Spieler' },
    { label: 'Solo-Farbe', value: 'Orange' },
    { label: 'Safezones', value: 'Nein', state: 'warning' },
    { label: 'Permadeath', value: '-10.000 Fame Points' },
    { label: 'Serverstatus', value: scumConfig?.enabled ? 'Aktiv überwacht' : 'Nicht konfiguriert', state: scumConfig?.enabled ? 'online' : 'muted' },
  ];
  return cards;
}

export function buildSupportPayload(categories: TicketCategoryConfig[]) {
  return {
    status: 'online',
    categories: categories.map(category => ({
      key: category.key,
      label: category.label,
      description: category.description,
      enabled: category.enabled === 1,
    })),
  };
}

export function buildWhitelistStatus(
  config: GuildConfig | null | undefined,
  member: GuildMember | null,
) {
  if (!member) {
    return {
      authenticated: false,
      loginRequired: true,
      configured: false,
      approved: null,
      nextStep: 'Melde dich mit Discord an, um deinen Whitelist-Status zu sehen.',
    };
  }

  const roleId = config?.whitelist_role_id ?? null;
  const configured = Boolean(roleId);
  const approved = configured ? member.roles.cache.has(roleId!) : null;

  return {
    authenticated: true,
    loginRequired: false,
    configured,
    approved,
    nextStep: !configured
      ? 'Whitelist ist aktuell nicht im Dashboard konfiguriert.'
      : approved
        ? 'Du bist freigeschaltet.'
        : 'Öffne ein Support-Ticket, um die Freischaltung zu klären.',
  };
}
