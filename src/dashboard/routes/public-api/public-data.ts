import type { GuildMember } from 'discord.js';
import type { StatusHistoryRow } from '../../../analytics/analytics.db';
import type { GuildConfig, ScumStatusConfig, TicketCategoryConfig } from '../../../types';

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

export function buildRulesPayload(config?: GuildConfig | null): PublicRulesPayload {
  return {
    lastUpdated: config?.updated_at ?? null,
    discordUrl: config ? discordMessageUrl(config.guild_id, config.rules_channel_id, config.rules_message_id) : null,
    categories: [
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
    ],
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
