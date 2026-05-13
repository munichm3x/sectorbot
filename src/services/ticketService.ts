import {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Guild,
  type GuildMember,
} from 'discord.js';
import { getConfig, getSupportRoles, getTicketCategories } from './guildConfigService';
import { createTicketWelcomeEmbed } from './embedService';
import { logEvent } from './logService';
import {
  createTicket as dbCreateTicket,
  findTicketByChannel,
  closeTicket as dbCloseTicket,
  claimTicket as dbClaimTicket,
} from '../db/index';
import { makeId, sanitizeChannelName, IDS } from '../utils/ids';
import { logger } from '../utils/logger';
import type { Ticket } from '../types';

// ─── Error Classification ─────────────────────────────────────────────────────

export type TicketErrorCode =
  | 'MISSING_SUPPORT_ROLES'
  | 'MISSING_BOT_PERMISSIONS'
  | 'INVALID_CATEGORY'
  | 'CHANNEL_CREATE_FAILED'
  | 'DB_WRITE_FAILED'
  | 'UNKNOWN_ERROR';

export class TicketError extends Error {
  readonly code: TicketErrorCode;
  constructor(code: TicketErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'TicketError';
  }
}

// ─── openTicket ───────────────────────────────────────────────────────────────

export async function openTicket(
  guild: Guild,
  member: GuildMember,
  categoryKey: string
): Promise<{ ticket: Ticket; channelId: string; welcomeFailed?: boolean }> {
  const config = getConfig(guild.id);
  const bot = guild.members.me;

  // Pre-flight: bot needs ManageChannels
  if (!bot || !bot.permissions.has(PermissionFlagsBits.ManageChannels)) {
    throw new TicketError(
      'MISSING_BOT_PERMISSIONS',
      'Dem Bot fehlt die Berechtigung „Kanäle verwalten". Gib der Bot-Rolle ManageChannels.'
    );
  }

  // Support roles must be configured
  const supportRoles = getSupportRoles(guild.id);
  if (supportRoles.length === 0) {
    throw new TicketError(
      'MISSING_SUPPORT_ROLES',
      'Es sind keine Support-Rollen konfiguriert. Öffne /setup und wähle mindestens eine Support-Rolle.'
    );
  }

  // Category must exist in DB
  const categories = getTicketCategories(guild.id);
  const cat = categories.find(c => c.key === categoryKey);
  if (!cat) {
    throw new TicketError(
      'INVALID_CATEGORY',
      'Die ausgewählte Ticket-Kategorie existiert nicht mehr in der Konfiguration. Aktualisiere das Ticket-Panel über /setup.'
    );
  }

  const catLabel    = `${cat.emoji} ${cat.label}`;
  const channelName = sanitizeChannelName(`ticket-${categoryKey}-${member.user.username}`);

  // Parent category is OPTIONAL — skip silently if the channel was deleted
  let parentCategoryId: string | undefined;
  if (config?.ticket_category_id) {
    const parentCh = await guild.channels.fetch(config.ticket_category_id).catch(() => null);
    if (parentCh) {
      parentCategoryId = config.ticket_category_id;
    } else {
      logger.warn(
        `[Guild ${guild.id}] Ticket-Parent-Kategorie ${config.ticket_category_id} nicht (mehr) gefunden — erstelle Ticket ohne Kategorie.`
      );
    }
  }

  // Create the ticket channel
  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    ...(parentCategoryId ? { parent: parentCategoryId } : {}),
    topic: `Ticket von ${member.user.username} | Kategorie: ${catLabel}`,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      ...supportRoles.map(roleId => ({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      })),
      {
        id: bot.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ],
  }).catch((err: unknown) => {
    logger.error('Ticket-Channel konnte nicht erstellt werden', {
      guildId: guild.id,
      userId: member.id,
      categoryKey,
      parentCategoryId: parentCategoryId ?? null,
      error: err,
    });
    throw new TicketError(
      'CHANNEL_CREATE_FAILED',
      'Der Ticket-Channel konnte nicht erstellt werden. Prüfe Bot-Berechtigungen und Channel-Limits.'
    );
  });

  // Save to DB
  let ticket: Ticket;
  try {
    ticket = dbCreateTicket({
      guild_id:       guild.id,
      channel_id:     channel.id,
      opener_user_id: member.id,
      category:       categoryKey,
      created_at:     Math.floor(Date.now() / 1000),
    });
  } catch (err) {
    logger.error('Ticket-Datenbankeintrag konnte nicht erstellt werden', {
      guildId: guild.id,
      channelId: channel.id,
      userId: member.id,
      error: err,
    });
    await channel.delete('Datenbankfehler beim Ticket-Erstellen').catch(() => void 0);
    throw new TicketError(
      'DB_WRITE_FAILED',
      'Datenbankfehler beim Speichern des Tickets. Kontaktiere einen Administrator.'
    );
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(makeId(IDS.TICKET_CLOSE, channel.id))
      .setLabel('Ticket schließen')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(makeId(IDS.TICKET_CLAIM, channel.id))
      .setLabel('Übernehmen')
      .setEmoji('📌')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(makeId(IDS.TICKET_ADD_PROMPT, channel.id))
      .setLabel('Benutzer hinzufügen')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(makeId(IDS.TICKET_REMOVE_PROMPT, channel.id))
      .setLabel('Benutzer entfernen')
      .setEmoji('🚫')
      .setStyle(ButtonStyle.Secondary),
  );

  const welcomeEmbed = createTicketWelcomeEmbed(member, catLabel, ticket.id, supportRoles);
  try {
    await channel.send({ embeds: [welcomeEmbed], components: [row] });
  } catch (sendErr) {
    logger.error('Bot kann Willkommensnachricht nicht in Ticket-Channel senden — Prüfe ViewChannel/SendMessages/EmbedLinks-Overwrites für Bot-Rolle.', {
      guildId:   guild.id,
      channelId: channel.id,
      ticketId:  ticket.id,
      error:     sendErr,
    });
    await logEvent(guild, 'Fehler', [
      { name: 'Aktion',   value: 'Willkommensnachricht nicht gesendet', inline: true },
      { name: 'Ticket',   value: `<#${channel.id}>`,                   inline: true },
      { name: 'Ursache',  value: sendErr instanceof Error ? sendErr.message.slice(0, 200) : String(sendErr).slice(0, 200), inline: false },
      { name: 'Lösung',   value: 'Prüfe Permission Overwrites (ViewChannel, SendMessages, EmbedLinks) für die Bot-Rolle im Ticket-Channel.', inline: false },
    ]);

    await logEvent(guild, 'Ticket erstellt', [
      { name: 'Ersteller',  value: `<@${member.id}>`,    inline: true },
      { name: 'Kategorie',  value: catLabel,              inline: true },
      { name: 'Kanal',      value: `<#${channel.id}>`,   inline: true },
      { name: 'Ticket-ID',  value: `#${ticket.id}`,      inline: true },
    ]);

    logger.info(`Ticket erstellt (ohne Willkommensnachricht): ${channel.name} von ${member.user.username}`);
    return { ticket, channelId: channel.id, welcomeFailed: true };
  }

  await logEvent(guild, 'Ticket erstellt', [
    { name: 'Ersteller',  value: `<@${member.id}>`,    inline: true },
    { name: 'Kategorie',  value: catLabel,              inline: true },
    { name: 'Kanal',      value: `<#${channel.id}>`,   inline: true },
    { name: 'Ticket-ID',  value: `#${ticket.id}`,      inline: true },
  ]);

  logger.info(`Ticket erstellt: ${channel.name} von ${member.user.username}`);
  return { ticket, channelId: channel.id };
}

export async function closeTicket(guild: Guild, channelId: string, closedBy: GuildMember): Promise<void> {
  const ticket = findTicketByChannel(channelId);

  await logEvent(guild, 'Ticket geschlossen', [
    { name: 'Kanal',           value: ticket ? `ticket-${ticket.category}` : channelId, inline: true },
    { name: 'Geschlossen von', value: `<@${closedBy.id}>`,                              inline: true },
    { name: 'Ersteller',       value: ticket ? `<@${ticket.opener_user_id}>` : 'Unbekannt', inline: true },
  ]);

  dbCloseTicket(channelId);

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (channel) await channel.delete('Ticket geschlossen');

  logger.info(`Ticket geschlossen: ${channelId} von ${closedBy.user.username}`);
}

export async function claimTicket(guild: Guild, channelId: string, claimer: GuildMember): Promise<boolean> {
  const ticket = findTicketByChannel(channelId);
  if (!ticket || ticket.status !== 'open' || ticket.claimed_by) return false;

  dbClaimTicket(channelId, claimer.id);

  await logEvent(guild, 'Ticket übernommen', [
    { name: 'Kanal',          value: `<#${channelId}>`,   inline: true },
    { name: 'Übernommen von', value: `<@${claimer.id}>`,  inline: true },
  ]);

  return true;
}

export async function addUserToTicket(
  guild: Guild, channelId: string, targetUserId: string, addedBy: GuildMember
): Promise<void> {
  const channel = await guild.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  await channel.permissionOverwrites.create(targetUserId, {
    ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true,
  });

  await logEvent(guild, 'Benutzer hinzugefügt', [
    { name: 'Kanal', value: `<#${channelId}>`,    inline: true },
    { name: 'User',  value: `<@${targetUserId}>`, inline: true },
    { name: 'Von',   value: `<@${addedBy.id}>`,   inline: true },
  ]);
}

export async function removeUserFromTicket(
  guild: Guild, channelId: string, targetUserId: string, removedBy: GuildMember
): Promise<void> {
  const channel = await guild.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  await channel.permissionOverwrites.delete(targetUserId);

  await logEvent(guild, 'Benutzer entfernt', [
    { name: 'Kanal', value: `<#${channelId}>`,    inline: true },
    { name: 'User',  value: `<@${targetUserId}>`, inline: true },
    { name: 'Von',   value: `<@${removedBy.id}>`, inline: true },
  ]);
}
