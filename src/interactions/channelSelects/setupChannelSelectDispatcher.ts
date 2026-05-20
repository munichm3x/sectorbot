import type { ChannelSelectMenuInteraction } from 'discord.js';
import { getConfig, upsertConfig } from '../../services/guildConfigService';
import {
  createWizardStep1Embed, buildWizardStep1Components,
  createWizardStep4Embed, buildWizardStep4Components,
  createWizardStep5Embed, buildWizardStep5Components,
} from '../../services/embedService';
import { isAdmin } from '../../services/permissionService';
import { replyError } from '../../utils/errors';
import type { ChannelSelectMenuHandler } from '../../types';
import {
  getChangelogConfig, upsertChangelogConfig,
  getScumStatusConfig, upsertScumStatusConfig,
} from '../../db/index';
import {
  createWizardChangelogEmbed, buildWizardChangelogComponents,
  createWizardScumStatusEmbed, buildWizardScumStatusComponents,
} from '../../services/embedService';
import { startInterval } from '../../features/scumStatus/scumStatus.updater';

export const setupChannelSelectDispatcher: ChannelSelectMenuHandler = {
  prefix: 's',

  async execute(interaction: ChannelSelectMenuInteraction, payload: string) {
    if (!interaction.inCachedGuild()) return;

    if (!isAdmin(interaction.member)) {
      return replyError(interaction, 'Du benötigst Administrator- oder **Server verwalten**-Berechtigung.');
    }

    const { guild } = interaction;
    const guildId   = guild.id;
    const channelId = interaction.values[0];
    if (!channelId) return;

    // Step 1 – Ticket-Panel-Channel
    if (payload === 't:panel') {
      upsertConfig(guildId, { ticket_panel_channel_id: channelId });
      const config = getConfig(guildId)!;
      return interaction.update({
        embeds: [createWizardStep1Embed(config)],
        components: buildWizardStep1Components(),
      });
    }

    // Step 4 – Log-Channel
    if (payload === 't:log') {
      upsertConfig(guildId, { ticket_log_channel_id: channelId });
      const config = getConfig(guildId)!;
      return interaction.update({
        embeds: [createWizardStep4Embed(config)],
        components: buildWizardStep4Components(),
      });
    }

    // Step 4 – Archiv-Channel
    if (payload === 't:arch') {
      upsertConfig(guildId, { ticket_archive_channel_id: channelId });
      const config = getConfig(guildId)!;
      return interaction.update({
        embeds: [createWizardStep4Embed(config)],
        components: buildWizardStep4Components(),
      });
    }

    // Step 5 – Regelwerk-Channel
    if (payload === 'r:ch') {
      upsertConfig(guildId, { rules_channel_id: channelId });
      const config = getConfig(guildId)!;
      return interaction.update({
        embeds: [createWizardStep5Embed(config)],
        components: buildWizardStep5Components(),
      });
    }

    // Changelog – Erstellen-Kanal
    if (payload === 'cl:create') {
      upsertChangelogConfig(guildId, { create_channel_id: channelId });
      const clConfig = getChangelogConfig(guildId)!;
      return interaction.update({
        embeds:     [createWizardChangelogEmbed(clConfig)],
        components: buildWizardChangelogComponents(),
      });
    }

    // Changelog – Öffentlicher Kanal
    if (payload === 'cl:public') {
      upsertChangelogConfig(guildId, { public_channel_id: channelId });
      const clConfig = getChangelogConfig(guildId)!;
      return interaction.update({
        embeds:     [createWizardChangelogEmbed(clConfig)],
        components: buildWizardChangelogComponents(),
      });
    }

    // SCUM Status – Status-Channel
    if (payload === 'ss:channel') {
      upsertScumStatusConfig(guildId, { channel_id: channelId });

      const scumConfig = getScumStatusConfig(guildId);
      if (scumConfig?.enabled && scumConfig.host && scumConfig.query_port) {
        startInterval(guildId);
      }

      const updated = getScumStatusConfig(guildId);
      return interaction.update({
        embeds:     [createWizardScumStatusEmbed(updated)],
        components: buildWizardScumStatusComponents(updated),
      });
    }
  },
};
