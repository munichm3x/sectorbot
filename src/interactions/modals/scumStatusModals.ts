import type { ModalSubmitInteraction } from 'discord.js';
import { getScumStatusConfig, upsertScumStatusConfig } from '../../db/index';
import {
  createWizardScumStatusEmbed, buildWizardScumStatusComponents,
} from '../../services/embedService';
import { startInterval } from '../../features/scumStatus/scumStatus.updater';
import { isAdmin } from '../../services/permissionService';
import { replyError } from '../../utils/errors';
import type { ModalHandler } from '../../types';

const MIN_INTERVAL_SECS = 30;

export const scumStatusModalHandler: ModalHandler = {
  prefix: 'scum_status',

  async execute(interaction: ModalSubmitInteraction, payload: string) {
    if (!interaction.inCachedGuild()) return;

    if (!isAdmin(interaction.member)) {
      return replyError(interaction, 'Du benötigst Administrator- oder **Server verwalten**-Berechtigung.');
    }

    const guildId = interaction.guildId;

    // ── Server konfigurieren (Host + Port) ─────────────────────────────────────

    if (payload === 'config') {
      const host      = interaction.fields.getTextInputValue('host').trim();
      const portRaw   = interaction.fields.getTextInputValue('query_port').trim();
      const queryPort = parseInt(portRaw, 10);

      if (!host) {
        return replyError(interaction, 'Bitte gib eine gültige Server-IP oder Domain ein.');
      }
      if (isNaN(queryPort) || queryPort < 1 || queryPort > 65535) {
        return replyError(interaction, 'Bitte gib einen gültigen Port ein (1–65535).');
      }

      upsertScumStatusConfig(guildId, { host, query_port: queryPort });

      const config = getScumStatusConfig(guildId);
      if (config?.enabled && config.channel_id) startInterval(guildId);

      const updated = getScumStatusConfig(guildId);
      return interaction.reply({
        ephemeral:  true,
        embeds:     [createWizardScumStatusEmbed(updated)],
        components: buildWizardScumStatusComponents(updated),
      });
    }

    // ── Intervall setzen ────────────────────────────────────────────────────────

    if (payload === 'interval') {
      const raw  = interaction.fields.getTextInputValue('interval_secs').trim();
      const secs = parseInt(raw, 10);

      if (isNaN(secs) || secs < 1) {
        return replyError(interaction, 'Bitte gib eine gültige Zahl in Sekunden ein.');
      }

      const clamped = Math.max(secs, MIN_INTERVAL_SECS);
      upsertScumStatusConfig(guildId, { update_interval_secs: clamped });

      const config = getScumStatusConfig(guildId);
      if (config?.enabled && config.channel_id && config.host) startInterval(guildId);

      const updated = getScumStatusConfig(guildId);
      const note    = secs < MIN_INTERVAL_SECS
        ? ` (auf Minimum ${MIN_INTERVAL_SECS}s hochgesetzt)`
        : '';

      return interaction.reply({
        ephemeral:  true,
        content:    `✅ Intervall auf **${clamped} Sekunden** gesetzt${note}.`,
        embeds:     [createWizardScumStatusEmbed(updated)],
        components: buildWizardScumStatusComponents(updated),
      });
    }
  },
};
