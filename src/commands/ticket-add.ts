import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { findTicketByChannel } from '../db/index';
import { canModerateTicket } from '../services/permissionService';
import { addUserToTicket } from '../services/ticketService';
import { createSuccessEmbed } from '../services/embedService';
import { replyError } from '../utils/errors';
import type { Command } from '../types';

export const ticketAddCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket-add')
    .setDescription('Fügt einen Benutzer zum Ticket hinzu')
    .addUserOption(opt =>
      opt.setName('user').setDescription('Der hinzuzufügende Benutzer').setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    const ticket = findTicketByChannel(interaction.channelId);
    if (!ticket) return replyError(interaction, 'Dieser Command funktioniert nur in Ticket-Channels.');
    if (!canModerateTicket(interaction.member, ticket, interaction.guildId)) return replyError(interaction, 'Keine Berechtigung.');

    const target = interaction.options.getUser('user', true);
    await addUserToTicket(interaction.guild, interaction.channelId, target.id, interaction.member);

    await interaction.reply({
      embeds: [createSuccessEmbed(`<@${target.id}> wurde zum Ticket hinzugefügt.`)],
      ephemeral: true,
    });
  },
};
