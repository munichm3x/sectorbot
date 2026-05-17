import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  type ButtonInteraction,
} from 'discord.js';
import {
  getConfig, upsertConfig, getSupportRoles, getAllCategories,
  seedDefaultCategories, deleteCategory, getTicketCategories,
} from '../../../services/guildConfigService';
import {
  createWizardStep0Embed, buildWizardStep0Components,
  createWizardStep1Embed, buildWizardStep1Components,
  createWizardStep2Embed, buildWizardStep2Components,
  createWizardStep3Embed, buildWizardStep3Components,
  createWizardStep4Embed, buildWizardStep4Components,
  createWizardStep5Embed, buildWizardStep5Components,
  createWizardStep6Embed, buildWizardStep6Components,
  createWizardReviewEmbed, buildWizardReviewComponents,
  createWizardDoneEmbed, buildWizardDoneComponents,
  createDoctorEmbed, buildAddCategoryModal,
  createTicketPanelEmbed, buildTicketPanelSelectMenu, buildRulesAcceptButton,
  createRulesEmbed, createManageCategoriesEmbed, buildManageCategoriesComponents,
  createErrorEmbed,
} from '../../../services/embedService';
import { runDoctorChecks } from '../../../commands/doctor';
import { isAdmin } from '../../../services/permissionService';
import { replyError } from '../../../utils/errors';
import type { ButtonHandler } from '../../../types';
import { getChangelogConfig } from '../../../db/index';
import { createWizardChangelogEmbed, buildWizardChangelogComponents } from '../../../services/embedService';
import { ensureChangelogDashboard } from '../../../features/changelogDashboard';

export const setupButtonDispatcher: ButtonHandler = {
  prefix: 's',

  async execute(interaction: ButtonInteraction, payload: string) {
    if (!interaction.inCachedGuild()) return;

    if (!isAdmin(interaction.member)) {
      return replyError(interaction, 'Du benötigst Administrator- oder **Server verwalten**-Berechtigung.');
    }

    const { guild } = interaction;
    const guildId = guild.id;

    // ── Step 0 / Home ──────────────────────────────────────────────────────────

    if (payload === 'step:0' || payload === 'home') {
      const config      = getConfig(guildId);
      const supportRoles = getSupportRoles(guildId);
      const categories  = getAllCategories(guildId);
      return interaction.update({
        embeds: [createWizardStep0Embed(config, supportRoles, categories)],
        components: buildWizardStep0Components(),
      });
    }

    // ── Step 1 – Ticket-Panel-Channel ──────────────────────────────────────────

    if (payload === 'step:1') {
      const config = upsertConfig(guildId, {});
      return interaction.update({
        embeds: [createWizardStep1Embed(config)],
        components: buildWizardStep1Components(),
      });
    }

    // ── Step 2 – Öffentliche Ticket-Kategorien ─────────────────────────────────

    if (payload === 'step:2') {
      const categories = getAllCategories(guildId);
      return interaction.update({
        embeds: [createWizardStep2Embed(categories)],
        components: buildWizardStep2Components(categories.length > 0),
      });
    }

    // ── Step 3 – Support-Rollen ────────────────────────────────────────────────

    if (payload === 'step:3') {
      const supportRoles = getSupportRoles(guildId);
      return interaction.update({
        embeds: [createWizardStep3Embed(supportRoles)],
        components: buildWizardStep3Components(),
      });
    }

    // ── Step 4 – Log-Channel ───────────────────────────────────────────────────

    if (payload === 'step:4') {
      const config = upsertConfig(guildId, {});
      return interaction.update({
        embeds: [createWizardStep4Embed(config)],
        components: buildWizardStep4Components(),
      });
    }

    // ── Step 5 – Regelwerk-Channel ─────────────────────────────────────────────

    if (payload === 'step:5') {
      const config = upsertConfig(guildId, {});
      return interaction.update({
        embeds: [createWizardStep5Embed(config)],
        components: buildWizardStep5Components(),
      });
    }

    // ── Step 6 – Whitelist-Rolle ───────────────────────────────────────────────

    if (payload === 'step:6') {
      const config = upsertConfig(guildId, {});
      return interaction.update({
        embeds: [createWizardStep6Embed(config, guild)],
        components: buildWizardStep6Components(),
      });
    }

    // ── Step 7 – Review ────────────────────────────────────────────────────────

    if (payload === 'step:7') {
      const config       = upsertConfig(guildId, {});
      const supportRoles = getSupportRoles(guildId);
      const categories   = getAllCategories(guildId);
      return interaction.update({
        embeds: [createWizardReviewEmbed(config, supportRoles, categories)],
        components: buildWizardReviewComponents(config, supportRoles, categories),
      });
    }

    // ── Cancel / Close ─────────────────────────────────────────────────────────

    if (payload === 'step:cancel') {
      return interaction.update({ content: '↩️ Setup geschlossen.', embeds: [], components: [] });
    }

    if (payload === 'step:close') {
      return interaction.update({
        content: '✅ Einrichtung abgeschlossen. Du kannst diese Nachricht schließen.',
        embeds: [],
        components: [],
      });
    }

    // ── Seed default categories ────────────────────────────────────────────────

    if (payload === 'cats:seed') {
      seedDefaultCategories(guildId);
      const categories = getAllCategories(guildId);
      return interaction.update({
        embeds: [createWizardStep2Embed(categories)],
        components: buildWizardStep2Components(categories.length > 0),
      });
    }

    // ── Manage categories ──────────────────────────────────────────────────────

    if (payload === 't:cats') {
      const categories = getAllCategories(guildId);
      return interaction.update({
        embeds: [createManageCategoriesEmbed(categories)],
        components: buildManageCategoriesComponents(categories),
      });
    }

    if (payload === 't:cat:add') {
      return interaction.showModal(buildAddCategoryModal());
    }

    if (payload.startsWith('t:cat:del:')) {
      const key = payload.slice('t:cat:del:'.length);
      deleteCategory(guildId, key);
      const categories = getAllCategories(guildId);
      return interaction.update({
        embeds: [createManageCategoriesEmbed(categories)],
        components: buildManageCategoriesComponents(categories),
      });
    }

    // ── Diagnose ───────────────────────────────────────────────────────────────

    if (payload === 'doctor') {
      await interaction.deferUpdate();
      const checks = await runDoctorChecks(guild);
      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('s:step:0').setLabel('Setup öffnen').setEmoji('⚙️').setStyle(ButtonStyle.Primary),
      );
      return interaction.editReply({
        embeds: [createDoctorEmbed(checks)],
        components: [backRow],
      });
    }

    // ── Publish both panels ────────────────────────────────────────────────────

    if (payload === 'pub:all') {
      const config = getConfig(guildId);

      if (!config?.ticket_panel_channel_id || !config.rules_channel_id) {
        const missing = [
          !config?.ticket_panel_channel_id && 'Ticket-Panel-Channel',
          !config?.rules_channel_id         && 'Regelwerk-Channel',
        ].filter(Boolean).join(', ');
        return replyError(interaction, `Fehlende Pflichtfelder: ${missing}.`);
      }

      await interaction.deferUpdate();

      // Seed categories if none exist
      seedDefaultCategories(guildId);
      const categories = getTicketCategories(guildId);

      // ── Publish ticket panel ───────────────────────────────────────────────
      const panelChannel = await guild.channels.fetch(config.ticket_panel_channel_id).catch(() => null);
      if (!panelChannel?.isTextBased()) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Ticket-Panel-Channel nicht gefunden oder ungültig. Bitte erneut konfigurieren.')],
          components: [],
        });
      }

      const panelEmbed  = createTicketPanelEmbed();
      const selectRow   = buildTicketPanelSelectMenu(categories);
      let panelMsgId    = config.ticket_panel_message_id ?? null;

      if (panelMsgId) {
        try {
          const msg = await panelChannel.messages.fetch(panelMsgId);
          await msg.edit({ embeds: [panelEmbed], components: [selectRow] });
        } catch {
          panelMsgId = null;
        }
      }
      if (!panelMsgId) {
        const msg = await panelChannel.send({ embeds: [panelEmbed], components: [selectRow] });
        panelMsgId = msg.id;
      }

      // ── Publish rules panel ────────────────────────────────────────────────
      const rulesChannel = await guild.channels.fetch(config.rules_channel_id).catch(() => null);
      if (!rulesChannel?.isTextBased()) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Regelwerk-Channel nicht gefunden oder ungültig. Bitte erneut konfigurieren.')],
          components: [],
        });
      }

      const rulesEmbed  = createRulesEmbed();
      const rulesButton = buildRulesAcceptButton();
      let rulesMsgId    = config.rules_message_id ?? null;

      if (rulesMsgId) {
        try {
          const msg = await rulesChannel.messages.fetch(rulesMsgId);
          await msg.edit({ embeds: [rulesEmbed], components: [rulesButton] });
        } catch {
          rulesMsgId = null;
        }
      }
      if (!rulesMsgId) {
        const msg = await rulesChannel.send({ embeds: [rulesEmbed], components: [rulesButton] });
        rulesMsgId = msg.id;
      }

      // ── Save & mark complete ───────────────────────────────────────────────
      upsertConfig(guildId, {
        ticket_panel_message_id: panelMsgId,
        rules_message_id: rulesMsgId,
        setup_completed: 1,
      });

      const finalConfig = getConfig(guildId)!;
      return interaction.editReply({
        embeds: [createWizardDoneEmbed(finalConfig)],
        components: buildWizardDoneComponents(),
      });
    }

    // ── Changelog-System setup ────────────────────────────────────────────────

    if (payload === 'cl:home') {
      const clConfig = getChangelogConfig(guildId);
      return interaction.update({
        embeds:     [createWizardChangelogEmbed(clConfig)],
        components: buildWizardChangelogComponents(),
      });
    }

    if (payload === 'cl:save') {
      const clConfig = getChangelogConfig(guildId);
      if (!clConfig?.create_channel_id || !clConfig.public_channel_id) {
        return replyError(interaction, 'Bitte wähle zuerst beide Kanäle aus.');
      }
      await interaction.deferUpdate();
      await ensureChangelogDashboard(guild);
      const updated = getChangelogConfig(guildId)!;
      return interaction.editReply({
        embeds:     [createWizardChangelogEmbed(updated)],
        components: buildWizardChangelogComponents(),
      });
    }
  },
};
