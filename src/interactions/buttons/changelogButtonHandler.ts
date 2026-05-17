import { PermissionFlagsBits, type ButtonInteraction } from 'discord.js';
import {
  getDraft, deleteDraft, draftKey,
  buildChangelogEmbed,
  buildChangelogModal1, buildChangelogModal2,
  buildDashboardEmbed, buildDashboardComponents,
  ensureChangelogDashboard,
} from '../../features/changelogDashboard';
import { getChangelogConfig } from '../../db/index';
import type { ButtonHandler } from '../../types';

function hasManageGuild(interaction: ButtonInteraction): boolean {
  if (!interaction.inCachedGuild()) return false;
  return interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
}

export const changelogButtonHandler: ButtonHandler = {
  prefix: 'changelog',

  async execute(interaction: ButtonInteraction, payload: string) {
    if (!interaction.inCachedGuild()) return;

    if (!hasManageGuild(interaction)) {
      return interaction.reply({
        content: 'Du hast keine Berechtigung, dieses Dashboard zu benutzen.',
        ephemeral: true,
      });
    }

    const { guild, user } = interaction;
    const guildId         = guild.id;
    const key             = draftKey(guildId, user.id);

    // ── Open first modal ───────────────────────────────────────────────────────

    if (payload === 'create') {
      return interaction.showModal(buildChangelogModal1());
    }

    // ── Refresh dashboard ──────────────────────────────────────────────────────

    if (payload === 'refresh') {
      await interaction.deferUpdate();
      await ensureChangelogDashboard(guild);
      const config = getChangelogConfig(guildId);
      if (!config) {
        return interaction.editReply({
          content: '⚠️ Changelog-System nicht konfiguriert. Bitte /setup → Changelog-System ausführen.',
        });
      }
      return interaction.editReply({
        embeds:     [buildDashboardEmbed(config)],
        components: buildDashboardComponents(),
      });
    }

    // ── Open second modal (from preview ephemeral) ─────────────────────────────

    if (payload === 'add_extra') {
      const draft = getDraft(key);
      if (!draft) {
        return interaction.reply({
          content: 'Dein Entwurf ist abgelaufen oder wurde bereits verworfen. Bitte starte neu.',
          ephemeral: true,
        });
      }
      return interaction.showModal(buildChangelogModal2());
    }

    // ── Publish changelog ──────────────────────────────────────────────────────

    if (payload === 'publish') {
      await interaction.deferUpdate();

      const draft = getDraft(key);
      if (!draft) {
        return interaction.editReply({
          content:    'Entwurf abgelaufen. Bitte neu erstellen.',
          embeds:     [],
          components: [],
        });
      }

      const hasContent = [draft.added, draft.changed, draft.fixed, draft.removed, draft.notes]
        .some(f => f.trim().length > 0);
      if (!hasContent) {
        return interaction.editReply({
          content:    '⚠️ Mindestens eine Kategorie muss ausgefüllt sein.',
          embeds:     [],
          components: [],
        });
      }

      const config = getChangelogConfig(guildId);
      if (!config?.public_channel_id) {
        return interaction.editReply({
          content:    '⚠️ Kein öffentlicher Changelog-Kanal konfiguriert. Bitte /setup → Changelog-System ausführen.',
          embeds:     [],
          components: [],
        });
      }

      const publicChannel = await guild.channels.fetch(config.public_channel_id).catch(() => null);
      if (!publicChannel?.isTextBased()) {
        return interaction.editReply({
          content:    '⚠️ Öffentlicher Changelog-Kanal nicht gefunden oder ungültig.',
          embeds:     [],
          components: [],
        });
      }

      const embed = buildChangelogEmbed(draft, { createdBy: user.username });
      await publicChannel.send({ embeds: [embed] });

      deleteDraft(key);

      return interaction.editReply({
        content:    '✅ Changelog wurde veröffentlicht.',
        embeds:     [],
        components: [],
      });
    }

    // ── Cancel / discard draft ─────────────────────────────────────────────────

    if (payload === 'cancel') {
      deleteDraft(key);
      return interaction.update({
        content:    '❌ Changelog-Entwurf wurde verworfen.',
        embeds:     [],
        components: [],
      });
    }
  },
};
