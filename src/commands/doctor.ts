import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Guild,
} from 'discord.js';
import { getConfig, getSupportRoles } from '../services/guildConfigService';
import { createDoctorEmbed } from '../services/embedService';
import { isAdmin } from '../services/permissionService';
import { replyError } from '../utils/errors';
import type { Command, DoctorCheck } from '../types';

export async function runDoctorChecks(guild: Guild): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  const config = getConfig(guild.id);
  const bot = guild.members.me;

  if (!config) {
    checks.push({ name: 'Konfiguration', status: 'error', detail: 'Keine Konfiguration vorhanden. Führe /setup aus.' });
    return checks;
  }
  checks.push({ name: 'Konfiguration', status: 'ok', detail: 'Konfiguration vorhanden.' });

  const panelCh = config.ticket_panel_channel_id
    ? await guild.channels.fetch(config.ticket_panel_channel_id).catch(() => null)
    : null;
  checks.push({
    name: 'Ticket-Panel-Channel',
    status: !config.ticket_panel_channel_id ? 'error' : panelCh ? 'ok' : 'error',
    detail: !config.ticket_panel_channel_id
      ? 'Nicht konfiguriert. Führe /setup → Ticket-System aus.'
      : panelCh
        ? `<#${config.ticket_panel_channel_id}> gefunden.`
        : 'Channel nicht gefunden (gelöscht?). Setup neu konfigurieren.',
  });

  const ticketCat = config.ticket_category_id
    ? await guild.channels.fetch(config.ticket_category_id).catch(() => null)
    : null;
  checks.push({
    name: 'Ticket-Kategorie (optional)',
    status: !config.ticket_category_id ? 'warn' : ticketCat ? 'ok' : 'warn',
    detail: !config.ticket_category_id
      ? 'Optional — Tickets werden ohne Discord-Kategorie erstellt.'
      : ticketCat
        ? `<#${config.ticket_category_id}> gefunden.`
        : 'Kategorie nicht gefunden (gelöscht?). Tickets werden ohne Kategorie erstellt.',
  });

  const logCh = config.ticket_log_channel_id
    ? await guild.channels.fetch(config.ticket_log_channel_id).catch(() => null)
    : null;
  checks.push({
    name: 'Log-Channel',
    status: !config.ticket_log_channel_id ? 'warn' : logCh ? 'ok' : 'error',
    detail: !config.ticket_log_channel_id
      ? 'Optional — nicht konfiguriert. Ticket-Logs werden nicht gespeichert.'
      : logCh
        ? `<#${config.ticket_log_channel_id}> gefunden.`
        : 'Channel nicht gefunden. Setup neu konfigurieren.',
  });

  const rulesCh = config.rules_channel_id
    ? await guild.channels.fetch(config.rules_channel_id).catch(() => null)
    : null;
  checks.push({
    name: 'Regelwerk-Channel',
    status: !config.rules_channel_id ? 'error' : rulesCh ? 'ok' : 'error',
    detail: !config.rules_channel_id
      ? 'Nicht konfiguriert. Führe /setup → Regelwerk aus.'
      : rulesCh
        ? `<#${config.rules_channel_id}> gefunden.`
        : 'Channel nicht gefunden. Setup neu konfigurieren.',
  });

  const wlRole = config.whitelist_role_id
    ? await guild.roles.fetch(config.whitelist_role_id).catch(() => null)
    : null;
  checks.push({
    name: 'Whitelist-Rolle',
    status: !config.whitelist_role_id ? 'error' : wlRole ? 'ok' : 'error',
    detail: !config.whitelist_role_id
      ? 'Nicht konfiguriert. Führe /setup → Regelwerk aus.'
      : wlRole
        ? `<@&${config.whitelist_role_id}> gefunden.`
        : 'Rolle nicht gefunden (gelöscht?). Setup neu konfigurieren.',
  });

  const supportRoles = getSupportRoles(guild.id);
  checks.push({
    name: 'Support-Rollen',
    status: supportRoles.length === 0 ? 'error' : 'ok',
    detail: supportRoles.length === 0
      ? 'Keine Support-Rollen konfiguriert. Führe /setup → Ticket-System aus.'
      : `${supportRoles.length} Rolle(n) konfiguriert.`,
  });

  const hasMC = bot?.permissions.has(PermissionFlagsBits.ManageChannels) ?? false;
  checks.push({
    name: 'Bot: ManageChannels',
    status: hasMC ? 'ok' : 'error',
    detail: hasMC ? 'Vorhanden.' : 'Fehlend — Tickets können nicht erstellt werden.',
  });

  const hasMR = bot?.permissions.has(PermissionFlagsBits.ManageRoles) ?? false;
  checks.push({
    name: 'Bot: ManageRoles',
    status: hasMR ? 'ok' : 'error',
    detail: hasMR ? 'Vorhanden.' : 'Fehlend — Whitelist-Rolle kann nicht vergeben werden.',
  });

  const hasSM = bot?.permissions.has(PermissionFlagsBits.SendMessages) ?? false;
  checks.push({
    name: 'Bot: SendMessages',
    status: hasSM ? 'ok' : 'error',
    detail: hasSM ? 'Vorhanden.' : 'Fehlend — Bot kann keine Nachrichten senden.',
  });

  const hasEL = bot?.permissions.has(PermissionFlagsBits.EmbedLinks) ?? false;
  checks.push({
    name: 'Bot: EmbedLinks',
    status: hasEL ? 'ok' : 'error',
    detail: hasEL ? 'Vorhanden.' : 'Fehlend — Embeds werden nicht angezeigt.',
  });

  if (wlRole && bot) {
    const above = bot.roles.highest.position > wlRole.position;
    checks.push({
      name: 'Bot-Rollenposition',
      status: above ? 'ok' : 'error',
      detail: above
        ? 'Bot-Rolle steht korrekt über der Whitelist-Rolle.'
        : 'Bot-Rolle steht unterhalb der Whitelist-Rolle. Verschiebe die Bot-Rolle in den Servereinstellungen über die Whitelist-Rolle.',
    });
  } else {
    checks.push({
      name: 'Bot-Rollenposition',
      status: 'warn',
      detail: 'Whitelist-Rolle nicht konfiguriert — Überprüfung übersprungen.',
    });
  }

  if (panelCh?.isTextBased() && bot) {
    const canWrite = panelCh.permissionsFor(bot)?.has(PermissionFlagsBits.SendMessages) ?? false;
    checks.push({
      name: 'Schreibzugriff: Panel-Channel',
      status: canWrite ? 'ok' : 'error',
      detail: canWrite ? 'Bot kann schreiben.' : 'Kein Schreibzugriff — Channel-Berechtigungen prüfen.',
    });
  } else {
    checks.push({
      name: 'Schreibzugriff: Panel-Channel',
      status: 'warn',
      detail: 'Panel-Channel nicht verfügbar — Überprüfung übersprungen.',
    });
  }

  if (rulesCh?.isTextBased() && bot) {
    const canWrite = rulesCh.permissionsFor(bot)?.has(PermissionFlagsBits.SendMessages) ?? false;
    checks.push({
      name: 'Schreibzugriff: Regelwerk-Channel',
      status: canWrite ? 'ok' : 'error',
      detail: canWrite ? 'Bot kann schreiben.' : 'Kein Schreibzugriff — Channel-Berechtigungen prüfen.',
    });
  } else {
    checks.push({
      name: 'Schreibzugriff: Regelwerk-Channel',
      status: 'warn',
      detail: 'Regelwerk-Channel nicht verfügbar — Überprüfung übersprungen.',
    });
  }

  if (config.ticket_panel_message_id && panelCh?.isTextBased()) {
    const msg = await panelCh.messages.fetch(config.ticket_panel_message_id).catch(() => null);
    checks.push({
      name: 'Panel-Nachricht',
      status: msg ? 'ok' : 'warn',
      detail: msg ? 'Panel-Nachricht vorhanden.' : 'Nicht mehr vorhanden — Panel neu veröffentlichen.',
    });
  } else {
    checks.push({
      name: 'Panel-Nachricht',
      status: 'warn',
      detail: !config.ticket_panel_message_id
        ? 'Panel noch nicht veröffentlicht. Führe /setup aus und veröffentliche das Panel.'
        : 'Panel-Channel nicht verfügbar.',
    });
  }

  return checks;
}

export const doctorCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('doctor')
    .setDescription('Diagnose-Checks ausführen'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;

    if (!isAdmin(interaction.member)) {
      return replyError(interaction, 'Du benötigst Administrator- oder **Server verwalten**-Berechtigung.');
    }

    await interaction.deferReply({ ephemeral: true });

    const checks = await runDoctorChecks(interaction.guild);
    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('s:step:0').setLabel('Setup öffnen').setEmoji('⚙️').setStyle(ButtonStyle.Primary)
    );

    await interaction.editReply({
      embeds: [createDoctorEmbed(checks)],
      components: [backRow],
    });
  },
};
