import type { ModalSubmitInteraction } from 'discord.js';
import {
  getDraft, setDraft, draftKey,
  buildChangelogEmbed, buildPreviewComponents,
} from '../../features/changelogDashboard';
import type { ModalHandler, ChangelogDraft } from '../../types';

export const changelogModalHandler: ModalHandler = {
  prefix: 'changelog',

  async execute(interaction: ModalSubmitInteraction, payload: string) {
    if (!interaction.inCachedGuild()) return;

    const { guild, user } = interaction;
    const key             = draftKey(guild.id, user.id);

    // ── Modal 1 – version / title / added / changed / fixed ───────────────────

    if (payload === 'm1') {
      const version = interaction.fields.getTextInputValue('version').trim();
      const title   = interaction.fields.getTextInputValue('title').trim();
      const added   = interaction.fields.getTextInputValue('added').trim();
      const changed = interaction.fields.getTextInputValue('changed').trim();
      const fixed   = interaction.fields.getTextInputValue('fixed').trim();

      const draft: ChangelogDraft = {
        version,
        title,
        added,
        changed,
        fixed,
        removed:   '',
        notes:     '',
        createdAt: Date.now(),
      };

      setDraft(key, draft);

      const preview    = buildChangelogEmbed(draft, { preview: true });
      const components = buildPreviewComponents();

      return interaction.reply({ embeds: [preview], components, ephemeral: true });
    }

    // ── Modal 2 – removed / notes ─────────────────────────────────────────────

    if (payload === 'm2') {
      const existing = getDraft(key);
      if (!existing) {
        return interaction.reply({
          content:   'Dein Entwurf ist abgelaufen. Bitte starte neu.',
          ephemeral: true,
        });
      }

      const removed = interaction.fields.getTextInputValue('removed').trim();
      const notes   = interaction.fields.getTextInputValue('notes').trim();

      const updated: ChangelogDraft = { ...existing, removed, notes };
      setDraft(key, updated);

      const preview    = buildChangelogEmbed(updated, { preview: true });
      const components = buildPreviewComponents();

      if (interaction.isFromMessage()) {
        return interaction.update({ embeds: [preview], components });
      }
      return interaction.reply({ embeds: [preview], components, ephemeral: true });
    }
  },
};
