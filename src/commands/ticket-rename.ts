import {
  SlashCommandBuilder,
  ChannelType,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { findTicketByChannel } from '../db/index';
import { canModerateTicket } from '../services/permissionService';
import { createSuccessEmbed } from '../services/embedService';
import { logEvent } from '../services/logService';
import { sanitizeChannelName } from '../utils/ids';
import { replyError } from '../utils/errors';
import type { Command } from '../types';

export const ticketRenameCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket-rename')
    .setDescription('Benennt den Ticket-Channel um')
    .addStringOption(opt =>
      opt.setName('name').setDescription('Neuer Kanalname').setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(interaction.channelId);
    if (!ticket) return replyError(interaction, 'Dieser Command funktioniert nur in Ticket-Channels.');
    if (!canModerateTicket(interaction.member, ticket, interaction.guildId)) return replyError(interaction, 'Keine Berechtigung.');

    const rawName = interaction.options.getString('name', true);
    const newName = sanitizeChannelName(`ticket-${rawName}`);

    const channel = interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) return;

    const oldName = channel.name;
    await channel.setName(newName, `Umbenannt von ${interaction.user.tag}`);

    await logEvent(interaction.guild, 'Ticket umbenannt', [
      { name: 'Alter Name', value: oldName, inline: true },
      { name: 'Neuer Name', value: newName, inline: true },
      { name: 'Von',        value: `<@${interaction.member.id}>`, inline: true },
    ]);

    await interaction.reply({
      embeds: [createSuccessEmbed(`Kanal zu \`${newName}\` umbenannt.`)],
      ephemeral: true,
    });
  },
};
