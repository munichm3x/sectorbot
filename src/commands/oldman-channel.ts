import { SlashCommandBuilder, ChannelType, type ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../types';
import { isAdmin } from '../services/permissionService';
import { getOldManChannel, setOldManChannel, disableOldManChannel } from '../db/index';
import { replyError } from '../utils/errors';

export const oldmanChannelCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('oldman-channel')
    .setDescription('Configure the Old Man Lore channel for this server')
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Set the Old Man Lore channel')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('The channel to use for Old Man Lore')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('show')
        .setDescription('Show the current Old Man Lore channel')
    )
    .addSubcommand(sub =>
      sub
        .setName('disable')
        .setDescription('Disable the Old Man Lore channel')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ ephemeral: true, content: 'This command can only be used in a server.' });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'show') {
      const channelId = getOldManChannel(interaction.guildId);
      if (!channelId) {
        return replyError(interaction, 'No Old Man channel configured for this server.');
      } else {
        await interaction.reply({ ephemeral: true, content: `Old Man channel: <#${channelId}>` });
      }
      return;
    }

    if (!isAdmin(interaction.member)) {
      return replyError(interaction, 'You need the Manage Server permission to use this command.');
    }

    if (sub === 'set') {
      const channel = interaction.options.getChannel('channel', true);
      setOldManChannel(interaction.guildId, channel.id);
      await interaction.reply({ ephemeral: true, content: `Old Man channel set to <#${channel.id}>` });
    }

    if (sub === 'disable') {
      disableOldManChannel(interaction.guildId);
      await interaction.reply({ ephemeral: true, content: 'Old Man channel disabled.' });
    }
  },
};
