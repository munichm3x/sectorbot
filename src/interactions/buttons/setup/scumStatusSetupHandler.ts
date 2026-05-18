import { PermissionFlagsBits, type ButtonInteraction } from 'discord.js';
import {
  getScumStatusConfig, upsertScumStatusConfig,
  setScumStatusMessageId, setScumStatusEnabled,
} from '../../../db/index';
import {
  createWizardScumStatusEmbed, buildWizardScumStatusComponents,
} from '../../../services/embedService';
import { buildScumConfigModal, buildScumIntervalModal, buildStatusEmbed } from '../../../features/scumStatus/scumStatus.embed';
import { startInterval, stopInterval } from '../../../features/scumStatus/scumStatus.updater';
import { isAdmin } from '../../../services/permissionService';
import { replyError } from '../../../utils/errors';
import type { ButtonHandler } from '../../../types';

export const scumStatusSetupHandler: ButtonHandler = {
  prefix: 'ss',

  async execute(interaction: ButtonInteraction, payload: string) {
    if (!interaction.inCachedGuild()) return;

    if (!isAdmin(interaction.member)) {
      return replyError(interaction, 'Du benötigst Administrator- oder **Server verwalten**-Berechtigung.');
    }

    const { guild } = interaction;
    const guildId   = guild.id;

    // ── Home / Wizard-Seite ────────────────────────────────────────────────────

    if (payload === 'home') {
      const config = getScumStatusConfig(guildId);
      return interaction.update({
        embeds:     [createWizardScumStatusEmbed(config)],
        components: buildWizardScumStatusComponents(config),
      });
    }

    // ── Server konfigurieren (Modal öffnen) ────────────────────────────────────

    if (payload === 'config') {
      return interaction.showModal(buildScumConfigModal());
    }

    // ── Intervall setzen (Modal öffnen) ────────────────────────────────────────

    if (payload === 'interval') {
      const config = getScumStatusConfig(guildId);
      const current = config?.update_interval_secs ?? 60;
      return interaction.showModal(buildScumIntervalModal(current));
    }

    // ── Dashboard erstellen ────────────────────────────────────────────────────

    if (payload === 'create') {
      const config = getScumStatusConfig(guildId);

      if (!config?.channel_id || !config.host || !config.query_port) {
        return replyError(interaction, 'Bitte konfiguriere zuerst den Channel und den Server (IP + Port).');
      }

      const channel = await guild.channels.fetch(config.channel_id).catch(() => null);
      if (!channel?.isTextBased()) {
        return replyError(interaction, 'Der konfigurierte Channel wurde nicht gefunden oder ist ungültig.');
      }

      const me = guild.members.me;
      if (!me) return replyError(interaction, 'Bot-Member nicht gefunden.');

      const perms = channel.permissionsFor(me);
      const requiredPerms = [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ReadMessageHistory,
      ] as const;
      const missingPerms = requiredPerms.filter(p => !perms?.has(p));

      if (missingPerms.length > 0) {
        const names = missingPerms.map(p => {
          const map: Record<string, string> = {
            [String(PermissionFlagsBits.ViewChannel)]:        'Kanal anzeigen',
            [String(PermissionFlagsBits.SendMessages)]:       'Nachrichten senden',
            [String(PermissionFlagsBits.EmbedLinks)]:         'Links einbetten',
            [String(PermissionFlagsBits.ReadMessageHistory)]: 'Nachrichtenverlauf lesen',
          };
          return map[String(p)] ?? String(p);
        });
        return replyError(interaction, `Fehlende Bot-Berechtigungen im Channel: **${names.join(', ')}**`);
      }

      await interaction.deferUpdate();

      const embed = buildStatusEmbed({ online: false });
      const msg   = await channel.send({ embeds: [embed] });

      upsertScumStatusConfig(guildId, { enabled: 1 });
      setScumStatusMessageId(guildId, msg.id);
      startInterval(guildId);

      const updated = getScumStatusConfig(guildId);
      return interaction.editReply({
        embeds:     [createWizardScumStatusEmbed(updated)],
        components: buildWizardScumStatusComponents(updated),
      });
    }

    // ── Dashboard neu erstellen ────────────────────────────────────────────────

    if (payload === 'recreate') {
      const config = getScumStatusConfig(guildId);

      if (!config?.channel_id || !config.host || !config.query_port) {
        return replyError(interaction, 'Bitte konfiguriere zuerst den Channel und den Server (IP + Port).');
      }

      await interaction.deferUpdate();

      // Alte Nachricht löschen (best-effort)
      if (config.message_id) {
        try {
          const ch = await guild.channels.fetch(config.channel_id).catch(() => null);
          if (ch?.isTextBased()) {
            const oldMsg = await ch.messages.fetch(config.message_id).catch(() => null);
            if (oldMsg) await oldMsg.delete().catch(() => null);
          }
        } catch { /* ignorieren */ }
      }

      const channel = await guild.channels.fetch(config.channel_id).catch(() => null);
      if (!channel?.isTextBased()) {
        return interaction.editReply({ content: 'Channel nicht gefunden oder ungültig.', embeds: [], components: [] });
      }

      setScumStatusMessageId(guildId, null);
      stopInterval(guildId);

      const embed = buildStatusEmbed({ online: false });
      const msg   = await channel.send({ embeds: [embed] });
      setScumStatusMessageId(guildId, msg.id);
      startInterval(guildId);

      const updated = getScumStatusConfig(guildId);
      return interaction.editReply({
        embeds:     [createWizardScumStatusEmbed(updated)],
        components: buildWizardScumStatusComponents(updated),
      });
    }

    // ── Dashboard deaktivieren ─────────────────────────────────────────────────

    if (payload === 'disable') {
      setScumStatusEnabled(guildId, false);
      stopInterval(guildId);

      const updated = getScumStatusConfig(guildId);
      return interaction.update({
        embeds:     [createWizardScumStatusEmbed(updated)],
        components: buildWizardScumStatusComponents(updated),
      });
    }
  },
};
