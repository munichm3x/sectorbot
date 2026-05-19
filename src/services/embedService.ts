import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelType,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Guild,
  type GuildMember,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import { BRAND, SECTOR_COLORS } from '../ui/brand';
import type { GuildConfig, TicketCategoryConfig, DoctorCheck, ChangelogConfig, ScumStatusConfig } from '../types';
import { IDS } from '../utils/ids';
import { env } from '../config/env';

// ─── PUBLIC / BRANDED ─────────────────────────────────────────────────────────

export function createTicketPanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.SECTOR_RED)
    .setTitle('☣ SECTOR 13 Support')
    .setDescription('Wähle dein Anliegen aus, um ein privates Ticket mit dem Support-Team zu öffnen.')
    .addFields(
      { name: '🔒 Privat',    value: 'Nur du und das Support-Team können dein Ticket sehen.',                           inline: false },
      { name: '💬 Hinweise',  value: 'Beschreibe dein Anliegen möglichst genau. Screenshots oder Clips helfen bei der Bearbeitung.', inline: false },
      { name: '⚠ Missbrauch', value: 'Spam oder falsche Meldungen können sanktioniert werden.',                          inline: false },
    )
    .setFooter({ text: BRAND.FOOTER });
}

export function createTicketWelcomeEmbed(
  member: GuildMember,
  catLabel: string,
  ticketId: number,
  supportRoles: string[]
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(SECTOR_COLORS.BLOOD_RED)
    .setTitle('☣ SECTOR 13 Ticket')
    .setDescription(
      'Danke für deine Anfrage. Bitte beschreibe dein Anliegen so genau wie möglich. ' +
      'Das Support-Team meldet sich hier im Ticket.'
    )
    .addFields(
      { name: 'Ersteller',  value: `${member}`,         inline: true },
      { name: 'Kategorie',  value: catLabel,             inline: true },
      { name: 'Status',     value: 'Offen',              inline: true },
      { name: 'Ticket-ID',  value: `#${ticketId}`,       inline: true },
      {
        name:  'Nächster Schritt',
        value: 'Beschreibe dein Anliegen mit allen wichtigen Details. Screenshots, Clips, Fehlermeldungen oder Zeitpunkte helfen bei der Bearbeitung.',
        inline: false,
      },
    )
    .setFooter({ text: BRAND.FOOTER_SUPPORT })
    .setTimestamp();

  if (supportRoles.length > 0) {
    embed.addFields({
      name:  'Support-Team',
      value: supportRoles.map(id => `<@&${id}>`).join(' '),
      inline: false,
    });
  }

  return embed;
}

export function createRulesEmbed(): EmbedBuilder {
  const { RULES_BANNER_URL } = env;

  const embed = new EmbedBuilder()
    .setColor(0xA80000)
    .setTitle('📜 SECTOR 13 • REGELWERK')
    .setDescription(
      'Willkommen auf **SECTOR 13**.\n' +
      'Bitte lies dir alle Regeln vollständig durch, bevor du spielst.\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      '**§1 — Allgemeines Verhalten**\n' +
      'Respektvoller Umgang mit allen Spielern ist Pflicht. Beleidigungen, toxisches Verhalten, Rassismus, Sexismus oder gezielte Provokationen sind verboten. Konflikte werden sachlich geklärt oder dem Team gemeldet.\n\n' +
      '**§2 — Fair Play**\n' +
      'Cheats, Hacks, Exploits, Duping, Bugusing oder jede Form von Manipulation sind strengstens verboten. Offensichtliche Spielfehler müssen dem Team gemeldet werden.\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      '⚔️ **Teams & Gruppierungen**\n' +
      'Ein Team darf aus maximal **4 Spielern** bestehen und muss eine gemeinsame Armbandfarbe jederzeit sichtbar tragen.\n' +
      'Pro Team erlaubt: **1 Base** · **1 gesetzte Flagge** als offizielle Hauptbase.\n' +
      'Dauerhafte Allianzen, Massenteams oder versteckte Kooperationen zwischen Teams sind verboten.\n\n' +
      '🏹 **Einzelkämpfer**\n' +
      'Die Farbe **Orange** ist ausschließlich Einzelkämpfern vorbehalten — keine festen Allianzen oder Gruppierungen.\n' +
      'Einzelkämpfer dürfen: eigene Flagge · eigene Base · Fahrzeuge (inkl. Flugzeuge & Boote).\n' +
      'Eine sichtbare orange Armbinde muss jederzeit getragen werden.\n\n' +
      '💀 **PvP Regeln**\n' +
      'PvP ist auf der gesamten Insel jederzeit erlaubt — es existieren keine Safezones.\n' +
      'Verboten: Combat Logging · Streamsniping · Abuse-Verhalten · Umgehen von Spielmechaniken.\n' +
      'Basen müssen regelkonform gebaut sein. Glitch-Building, unraidbare Konstruktionen und das Blockieren wichtiger Zugänge sind untersagt.\n\n' +
      '🚗 **Fahrzeuge & Limits**\n' +
      'Pro Spieler: **1 Fahrzeug** · **1 Motorrad**.\n' +
      'Pro Base: **1 Flugzeug** · **2 Boote**.\n' +
      'Das absichtliche Verstecken oder Horten über dem erlaubten Limit ist untersagt.\n\n' +
      '☠️ **Permadeath**\n' +
      'Bei **-10.000 Fame Points** tritt permanenter Charaktertod ein.\n' +
      'Der Charakter gilt als verloren und muss vollständig neu erstellt werden.\n' +
      'Eine Wiederherstellung durch das Team erfolgt nicht.\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      '**§9 — Discord & Verhalten**\n' +
      'Spam, Werbung, unnötige Pings, NSFW-Inhalte und störendes Verhalten sind verboten. Support ausschließlich über das Ticket-System.\n\n' +
      '**§10–§12 — Sanktionen & Teamentscheid**\n' +
      'Das Team behält sich das letzte Entscheidungsrecht vor. Verstöße können zu Verwarnungen, temporären Sperren, Kick oder permanentem Bann führen. Unwissenheit schützt nicht vor Konsequenzen. Regeländerungen gelten ab Veröffentlichung automatisch.',
    )
    .setFooter({ text: 'SECTOR 13 • SCUM SERVER' });

  if (RULES_BANNER_URL) {
    embed.setImage(RULES_BANNER_URL);
  }

  return embed;
}

// ─── NEUTRAL / SYSTEM ─────────────────────────────────────────────────────────

export function createCloseConfirmEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.WARNING_AMBER)
    .setTitle('⚠️ Ticket schließen?')
    .setDescription('Möchtest du dieses Ticket wirklich schließen?\n\n**Der Kanal wird danach gelöscht.**');
}

export function createLogEmbed(
  event: string,
  fields: { name: string; value: string; inline?: boolean }[]
): EmbedBuilder {
  const colorMap: Record<string, number> = {
    'Ticket erstellt':      SECTOR_COLORS.MILITARY_GREEN,
    'Ticket geschlossen':   SECTOR_COLORS.BLOOD_RED,
    'Ticket übernommen':    SECTOR_COLORS.SECTOR_RED,
    'Benutzer hinzugefügt': SECTOR_COLORS.MILITARY_GREEN,
    'Benutzer entfernt':    SECTOR_COLORS.WARNING_AMBER,
    'Ticket umbenannt':     SECTOR_COLORS.CHARCOAL,
    'Fehler':               SECTOR_COLORS.BLOOD_RED,
  };

  return new EmbedBuilder()
    .setColor(colorMap[event] ?? SECTOR_COLORS.CHARCOAL)
    .setTitle(event)
    .addFields(fields)
    .setFooter({ text: BRAND.NAME })
    .setTimestamp();
}

export function createErrorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.BLOOD_RED)
    .setTitle('❌ Fehler')
    .setDescription(message);
}

export function createSuccessEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.MILITARY_GREEN)
    .setTitle('✅ Erfolgreich')
    .setDescription(message);
}

// ─── SETUP WIZARD ─────────────────────────────────────────────────────────────

/** Step 0 – Welcome & progress overview */
export function createWizardStep0Embed(
  config: GuildConfig | undefined,
  supportRoles: string[],
  categories: TicketCategoryConfig[],
): EmbedBuilder {
  const isCompleted = config?.setup_completed === 1;

  type Check = { label: string; done: boolean; optional?: boolean };
  const checks: Check[] = [
    { label: 'Ticket-Panel-Channel',       done: !!config?.ticket_panel_channel_id },
    { label: 'Öffentliche Kategorien',     done: categories.length > 0 },
    { label: 'Support-Rollen',             done: supportRoles.length > 0 },
    { label: 'Log-Channel',                done: !!config?.ticket_log_channel_id, optional: true },
    { label: 'Regelwerk-Channel',          done: !!config?.rules_channel_id },
    { label: 'Whitelist-Rolle',            done: !!config?.whitelist_role_id },
    { label: 'Ticket-Panel veröffentlicht', done: !!config?.ticket_panel_message_id },
    { label: 'Regelwerk veröffentlicht',   done: !!config?.rules_message_id },
  ];

  const required  = checks.filter(c => !c.optional);
  const doneCount = required.filter(c => c.done).length;

  return new EmbedBuilder()
    .setColor(isCompleted ? SECTOR_COLORS.MILITARY_GREEN : SECTOR_COLORS.SECTOR_RED)
    .setTitle('⚙️ Bot einrichten')
    .setDescription(
      'Dieser Assistent führt dich Schritt für Schritt durch die Einrichtung des Bot-Systems.\n\n' +
      checks.map(c =>
        `${c.done ? '✅' : c.optional ? '🔲' : '⬜'} ${c.label}${c.optional ? ' *(optional)*' : ''}`
      ).join('\n') +
      `\n\n*${doneCount}/${required.length} Pflichtfelder konfiguriert*` +
      (isCompleted ? '\n\n**✅ Bot ist eingerichtet und einsatzbereit.**' : '')
    )
    .setTimestamp();
}

export function buildWizardStep0Components(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('s:step:1').setLabel('Einrichtung starten').setEmoji('▶').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('s:cl:home').setLabel('Changelog-System').setEmoji('🧾').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ss:home').setLabel('Server-Status').setEmoji('🖥️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('s:doctor').setLabel('Diagnose').setEmoji('🩺').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('s:step:cancel').setLabel('Schließen').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

/** Step 1 – Ticket-Panel-Channel */
export function createWizardStep1Embed(config: GuildConfig): EmbedBuilder {
  const panelCh     = config.ticket_panel_channel_id ? `<#${config.ticket_panel_channel_id}>` : '⬜ *nicht gesetzt*';
  const panelStatus = config.ticket_panel_message_id ? '✅ Panel bereits veröffentlicht' : '⬜ Noch nicht veröffentlicht';

  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.SECTOR_RED)
    .setTitle('📢 Ticket-Panel-Channel')
    .setDescription('Wähle den Channel, in dem das öffentliche Ticket-Panel gepostet wird. Nutzer öffnen dort ein Ticket.')
    .addFields(
      { name: 'Ausgewählter Channel', value: panelCh,     inline: true },
      { name: 'Panel-Status',         value: panelStatus, inline: true },
    )
    .setFooter({ text: 'Schritt 1 von 7 • Bot einrichten' })
    .setTimestamp();
}

export function buildWizardStep1Components(): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  return [
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('s:t:panel')
        .setPlaceholder('📢 Ticket-Panel-Channel auswählen...')
        .setChannelTypes(ChannelType.GuildText)
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('s:step:0').setLabel('Zurück').setEmoji('◀').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('s:step:2').setLabel('Weiter').setEmoji('▶').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('s:step:cancel').setLabel('Abbrechen').setStyle(ButtonStyle.Secondary),
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
  ];
}

/** Step 2 – Öffentliche Ticket-Kategorien */
export function createWizardStep2Embed(categories: TicketCategoryConfig[]): EmbedBuilder {
  const list = categories.length === 0
    ? '*Keine Kategorien konfiguriert.*\nKlicke auf **"Standard-Kategorien laden"**, um Standard-Anliegen zu übernehmen.'
    : categories.map(c => `${c.emoji} **${c.label}** — ${c.description}`).join('\n');

  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.SECTOR_RED)
    .setTitle('📦 Öffentliche Ticket-Kategorien')
    .setDescription(
      'Diese Anliegen erscheinen im öffentlichen Ticket-Dropdown, wenn ein Nutzer ein Ticket öffnet.\n\n' + list
    )
    .setFooter({ text: 'Schritt 2 von 7 • Bot einrichten' })
    .setTimestamp();
}

export function buildWizardStep2Components(hasCats: boolean): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const buttons: ButtonBuilder[] = [];
  if (!hasCats) {
    buttons.push(
      new ButtonBuilder().setCustomId('s:cats:seed').setLabel('Standard-Kategorien laden').setEmoji('📦').setStyle(ButtonStyle.Success),
    );
  }
  buttons.push(
    new ButtonBuilder().setCustomId('s:t:cats').setLabel('Kategorien bearbeiten').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('s:step:1').setLabel('Zurück').setEmoji('◀').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('s:step:3').setLabel('Weiter').setEmoji('▶').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('s:step:cancel').setLabel('Abbrechen').setStyle(ButtonStyle.Secondary),
  );
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
  ];
}

/** Step 3 – Support-Rollen */
export function createWizardStep3Embed(supportRoles: string[]): EmbedBuilder {
  const rolesStr = supportRoles.length > 0
    ? supportRoles.map(r => `<@&${r}>`).join(' ')
    : '⬜ *keine gesetzt*';

  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.SECTOR_RED)
    .setTitle('👥 Support-Rollen')
    .setDescription('Wähle Rollen aus, die Tickets sehen und bearbeiten dürfen. Mehrfachauswahl ist möglich.')
    .addFields({ name: 'Konfigurierte Rollen', value: rolesStr, inline: false })
    .setFooter({ text: 'Schritt 3 von 7 • Bot einrichten' })
    .setTimestamp();
}

export function buildWizardStep3Components(): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  return [
    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId('s:t:supp')
        .setPlaceholder('👥 Support-Rollen auswählen...')
        .setMinValues(1)
        .setMaxValues(10)
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('s:step:2').setLabel('Zurück').setEmoji('◀').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('s:step:4').setLabel('Weiter').setEmoji('▶').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('s:step:cancel').setLabel('Abbrechen').setStyle(ButtonStyle.Secondary),
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
  ];
}

/** Step 4 – Log-Channel (optional) */
export function createWizardStep4Embed(config: GuildConfig): EmbedBuilder {
  const logCh = config.ticket_log_channel_id
    ? `<#${config.ticket_log_channel_id}>`
    : '*(nicht gesetzt — optional)*';

  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.SECTOR_RED)
    .setTitle('📋 Log-Channel *(optional)*')
    .setDescription(
      'Wähle einen Channel für Bot-Logs. Alle Ticket-Aktionen werden dort protokolliert.\n' +
      'Dieser Schritt ist **optional** — klicke auf **"Weiter"**, falls du keine Logs benötigst.'
    )
    .addFields({ name: 'Log-Channel', value: logCh, inline: true })
    .setFooter({ text: 'Schritt 4 von 7 • Bot einrichten' })
    .setTimestamp();
}

export function buildWizardStep4Components(): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  return [
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('s:t:log')
        .setPlaceholder('📋 Log-Channel auswählen (optional)...')
        .setChannelTypes(ChannelType.GuildText)
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('s:step:3').setLabel('Zurück').setEmoji('◀').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('s:step:5').setLabel('Weiter').setEmoji('▶').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('s:step:cancel').setLabel('Abbrechen').setStyle(ButtonStyle.Secondary),
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
  ];
}

/** Step 5 – Regelwerk-Channel */
export function createWizardStep5Embed(config: GuildConfig): EmbedBuilder {
  const rulesCh = config.rules_channel_id ? `<#${config.rules_channel_id}>` : '⬜ *nicht gesetzt*';
  const rulesMsg = config.rules_message_id ? '✅ Veröffentlicht' : '⬜ Noch nicht veröffentlicht';

  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.SECTOR_RED)
    .setTitle('📜 Regelwerk-Channel')
    .setDescription('Wähle den Channel, in dem Nutzer die Regeln akzeptieren und die Whitelist-Rolle erhalten.')
    .addFields(
      { name: 'Regelwerk-Channel', value: rulesCh,  inline: true },
      { name: 'Status',            value: rulesMsg, inline: true },
    )
    .setFooter({ text: 'Schritt 5 von 7 • Bot einrichten' })
    .setTimestamp();
}

export function buildWizardStep5Components(): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  return [
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('s:r:ch')
        .setPlaceholder('📜 Regelwerk-Channel auswählen...')
        .setChannelTypes(ChannelType.GuildText)
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('s:step:4').setLabel('Zurück').setEmoji('◀').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('s:step:6').setLabel('Weiter').setEmoji('▶').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('s:step:cancel').setLabel('Abbrechen').setStyle(ButtonStyle.Secondary),
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
  ];
}

/** Step 6 – Whitelist-Rolle */
export function createWizardStep6Embed(config: GuildConfig, guild: Guild): EmbedBuilder {
  const wlRole = config.whitelist_role_id ? `<@&${config.whitelist_role_id}>` : '⬜ *nicht gesetzt*';

  const warnings: string[] = [];
  const bot = guild.members.me;
  if (config.whitelist_role_id && bot) {
    const role = guild.roles.cache.get(config.whitelist_role_id);
    if (role) {
      if (!bot.permissions.has(PermissionFlagsBits.ManageRoles)) {
        warnings.push('⚠️ **Bot hat keine ManageRoles-Berechtigung.** Whitelist-Rolle kann nicht vergeben werden.');
      } else if (bot.roles.highest.position <= role.position) {
        warnings.push(
          '⚠️ **Bot-Rolle steht unterhalb der Whitelist-Rolle.** ' +
          'Verschiebe die Bot-Rolle in den Servereinstellungen über die Whitelist-Rolle.'
        );
      }
    }
  }

  const embed = new EmbedBuilder()
    .setColor(warnings.length > 0 ? SECTOR_COLORS.WARNING_AMBER : SECTOR_COLORS.SECTOR_RED)
    .setTitle('🎖 Whitelist-Rolle')
    .setDescription('Wähle die Rolle, die Nutzern nach Akzeptanz der Regeln automatisch vergeben wird.')
    .addFields({ name: 'Whitelist-Rolle', value: wlRole, inline: true });

  if (warnings.length > 0) {
    embed.addFields({ name: '⚠️ Warnungen', value: warnings.join('\n'), inline: false });
  }

  embed.setFooter({ text: 'Schritt 6 von 7 • Bot einrichten' }).setTimestamp();
  return embed;
}

export function buildWizardStep6Components(): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  return [
    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId('s:r:role')
        .setPlaceholder('🎖 Whitelist-Rolle auswählen...')
        .setMaxValues(1)
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('s:step:5').setLabel('Zurück').setEmoji('◀').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('s:step:7').setLabel('Weiter').setEmoji('▶').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('s:step:cancel').setLabel('Abbrechen').setStyle(ButtonStyle.Secondary),
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
  ];
}

/** Step 7 – Review / Überprüfung */
export function createWizardReviewEmbed(
  config: GuildConfig,
  supportRoles: string[],
  categories: TicketCategoryConfig[],
): EmbedBuilder {
  const f = (v: string | null) => v ? `<#${v}>` : '❌ *nicht gesetzt*';
  const r = (v: string | null) => v ? `<@&${v}>` : '❌ *nicht gesetzt*';

  const missing: string[] = [];
  if (!config.ticket_panel_channel_id) missing.push('Ticket-Panel-Channel');
  if (categories.length === 0)         missing.push('Öffentliche Kategorien');
  if (supportRoles.length === 0)       missing.push('Support-Rollen');
  if (!config.rules_channel_id)        missing.push('Regelwerk-Channel');
  if (!config.whitelist_role_id)       missing.push('Whitelist-Rolle');

  return new EmbedBuilder()
    .setColor(missing.length > 0 ? SECTOR_COLORS.WARNING_AMBER : SECTOR_COLORS.MILITARY_GREEN)
    .setTitle('📋 Überprüfung')
    .setDescription(
      missing.length > 0
        ? `⚠️ **Fehlende Pflichtfelder:** ${missing.join(', ')}\n\nGehe zurück und konfiguriere die fehlenden Felder.`
        : '✅ Alle Pflichtfelder sind konfiguriert. Klicke auf **"Panels veröffentlichen"**, um den Bot einzurichten.'
    )
    .addFields(
      { name: '📢 Ticket-Panel-Channel',   value: f(config.ticket_panel_channel_id), inline: true },
      { name: '📦 Öffentliche Kategorien', value: `${categories.length} Kategorien`,  inline: true },
      { name: '📋 Log-Channel',            value: config.ticket_log_channel_id ? `<#${config.ticket_log_channel_id}>` : '*(optional — nicht gesetzt)*', inline: true },
      {
        name: '👥 Support-Rollen',
        value: supportRoles.length > 0 ? supportRoles.map(id => `<@&${id}>`).join(' ') : '❌ *keine*',
        inline: false,
      },
      { name: '📜 Regelwerk-Channel', value: f(config.rules_channel_id),  inline: true },
      { name: '🎖 Whitelist-Rolle',   value: r(config.whitelist_role_id), inline: true },
    )
    .setFooter({ text: 'Schritt 7 von 7 • Bot einrichten' })
    .setTimestamp();
}

export function buildWizardReviewComponents(
  config: GuildConfig,
  supportRoles: string[],
  categories: TicketCategoryConfig[],
): ActionRowBuilder<ButtonBuilder>[] {
  const canPublish = !!(
    config.ticket_panel_channel_id &&
    config.rules_channel_id &&
    config.whitelist_role_id &&
    supportRoles.length > 0 &&
    categories.length > 0
  );

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('s:pub:all')
        .setLabel('Panels veröffentlichen')
        .setEmoji('🚀')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!canPublish),
      new ButtonBuilder().setCustomId('s:step:6').setLabel('Zurück').setEmoji('◀').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('s:step:cancel').setLabel('Abbrechen').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

/** Step 8 – Done / Abschluss */
export function createWizardDoneEmbed(config: GuildConfig): EmbedBuilder {
  const lines: string[] = ['Der Bot ist eingerichtet. Ticket-System und Regelwerk wurden veröffentlicht.\n'];
  if (config.ticket_panel_channel_id) lines.push(`📢 Ticket-Panel: <#${config.ticket_panel_channel_id}>`);
  if (config.rules_channel_id)        lines.push(`📜 Regelwerk: <#${config.rules_channel_id}>`);

  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.MILITARY_GREEN)
    .setTitle('✅ Einrichtung abgeschlossen')
    .setDescription(lines.join('\n'))
    .setFooter({ text: BRAND.NAME })
    .setTimestamp();
}

export function buildWizardDoneComponents(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('s:step:close')
        .setLabel('Schließen')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────

export function createAdminPanelEmbed(
  config: GuildConfig,
  supportRoles: string[],
  categories: TicketCategoryConfig[],
  guild: Guild
): EmbedBuilder {
  const f = (v: string | null) => v ? `<#${v}>` : '*nicht gesetzt*';
  const r = (v: string | null) => v ? `<@&${v}>` : '*nicht gesetzt*';

  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.CHARCOAL)
    .setTitle('Bot-Konfiguration')
    .setDescription(`**${guild.name}** — Aktuelle Konfiguration`)
    .addFields(
      { name: 'Panel-Channel',     value: f(config.ticket_panel_channel_id), inline: true },
      { name: 'Log-Channel',       value: f(config.ticket_log_channel_id),   inline: true },
      { name: 'Regelwerk-Channel', value: f(config.rules_channel_id),        inline: true },
      { name: 'Whitelist-Rolle',   value: r(config.whitelist_role_id),       inline: true },
      {
        name: 'Support-Rollen',
        value: supportRoles.length > 0 ? supportRoles.map(id => `<@&${id}>`).join(' ') : '*keine*',
        inline: true,
      },
      {
        name: 'Kategorien',
        value: categories.length > 0 ? categories.map(c => `${c.emoji} ${c.label}`).join(', ') : '*keine*',
        inline: false,
      },
      { name: 'Setup abgeschlossen', value: config.setup_completed ? '✅ Ja' : '⬜ Nein', inline: true },
    )
    .setTimestamp();
}

export function createDoctorEmbed(checks: DoctorCheck[]): EmbedBuilder {
  const statusLabel = { ok: '✅', warn: '⚠️', error: '❌' };
  const okCount  = checks.filter(c => c.status === 'ok').length;
  const hasError = checks.some(c => c.status === 'error');
  const hasWarn  = checks.some(c => c.status === 'warn');

  return new EmbedBuilder()
    .setColor(hasError ? SECTOR_COLORS.BLOOD_RED : hasWarn ? SECTOR_COLORS.WARNING_AMBER : SECTOR_COLORS.MILITARY_GREEN)
    .setTitle(`🩺 Diagnose — ${okCount}/${checks.length} Checks bestanden`)
    .setDescription(checks.map(c => `${statusLabel[c.status]} **${c.name}**: ${c.detail}`).join('\n'))
    .setTimestamp();
}

// ─── MANAGE CATEGORIES ────────────────────────────────────────────────────────

export function createManageCategoriesEmbed(categories: TicketCategoryConfig[]): EmbedBuilder {
  const list = categories.length === 0
    ? '*Keine Kategorien konfiguriert.*'
    : categories.map((c, i) => `**${i + 1}.** ${c.emoji} **${c.label}** (\`${c.key}\`) ${c.enabled ? '✅' : '❌'}`).join('\n');

  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.CHARCOAL)
    .setTitle('📦 Ticket-Kategorien verwalten')
    .setDescription(`${list}\n\nVerwende die Buttons unten, um Kategorien hinzuzufügen oder zu löschen.`)
    .setTimestamp();
}

export function buildManageCategoriesComponents(categories: TicketCategoryConfig[]): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

  const chunks: TicketCategoryConfig[][] = [];
  for (let i = 0; i < Math.min(categories.length, 15); i += 5) {
    chunks.push(categories.slice(i, i + 5));
  }
  for (const chunk of chunks) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...chunk.map(cat =>
        new ButtonBuilder()
          .setCustomId(`s:t:cat:del:${cat.key}`)
          .setLabel(`🗑 ${cat.label.slice(0, 20)}`)
          .setStyle(ButtonStyle.Danger)
      )
    );
    rows.push(row as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>);
  }

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('s:t:cat:add').setLabel('Kategorie hinzufügen').setEmoji('➕').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('s:step:2').setLabel('Zurück').setEmoji('◀').setStyle(ButtonStyle.Secondary),
  );
  rows.push(actionRow as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>);

  return rows;
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

export function buildTicketPanelSelectMenu(categories: TicketCategoryConfig[]): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(IDS.TICKET_CATEGORY)
      .setPlaceholder('Wähle dein Anliegen …')
      .addOptions(
        categories.map(cat =>
          new StringSelectMenuOptionBuilder()
            .setLabel(cat.label)
            .setDescription(cat.description)
            .setValue(cat.key)
            .setEmoji(cat.emoji)
        )
      )
  );
}

export function buildRulesAcceptButton(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(IDS.ACCEPT_RULES)
      .setLabel('Regeln akzeptieren')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
  );
}

export function buildAddCategoryModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('setup:cat:add')
    .setTitle('Kategorie hinzufügen')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('key')
          .setLabel('Schlüssel (eindeutig, keine Leerzeichen)')
          .setPlaceholder('z.B. vip-support')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(32)
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('label')
          .setLabel('Anzeigename')
          .setPlaceholder('z.B. VIP Support')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(50)
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Beschreibung')
          .setPlaceholder('z.B. Für VIP-Spieler')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100)
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('emoji')
          .setLabel('Emoji')
          .setPlaceholder('z.B. ⭐')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(10)
          .setRequired(true)
      ),
    );
}

// ─── CHANGELOG SETUP STEP ─────────────────────────────────────────────────────

export function createWizardChangelogEmbed(config: ChangelogConfig | undefined): EmbedBuilder {
  const createCh = config?.create_channel_id ? `<#${config.create_channel_id}>` : '⬜ *nicht gesetzt*';
  const publicCh = config?.public_channel_id ? `<#${config.public_channel_id}>` : '⬜ *nicht gesetzt*';
  const hasConfig = !!(config?.create_channel_id && config?.public_channel_id);

  return new EmbedBuilder()
    .setColor(hasConfig ? SECTOR_COLORS.MILITARY_GREEN : SECTOR_COLORS.SECTOR_RED)
    .setTitle('🧾 Changelog-System einrichten')
    .setDescription(
      'Wähle einen **privaten Team-Kanal** für das Dashboard (nur euer Team sieht es) ' +
      'und einen **öffentlichen Kanal**, in dem jeder veröffentlichte Changelog erscheint.\n\n' +
      'Nach der Auswahl beider Kanäle: **„Dashboard erstellen"** klicken.'
    )
    .addFields(
      { name: '📝 Erstellen-Kanal (privat)',     value: createCh, inline: true },
      { name: '📢 Öffentlicher Changelog-Kanal', value: publicCh, inline: true },
    )
    .setFooter({ text: 'Changelog-System • Bot einrichten' })
    .setTimestamp();
}

export function buildWizardChangelogComponents(): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  return [
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('s:cl:create')
        .setPlaceholder('📝 Erstellen-Kanal (privat) auswählen...')
        .setChannelTypes(ChannelType.GuildText),
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('s:cl:public')
        .setPlaceholder('📢 Öffentlichen Changelog-Kanal auswählen...')
        .setChannelTypes(ChannelType.GuildText),
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('s:step:0')
        .setLabel('Zurück')
        .setEmoji('◀')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('s:cl:save')
        .setLabel('Dashboard erstellen')
        .setEmoji('🧾')
        .setStyle(ButtonStyle.Success),
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
  ];
}

// ─── SCUM STATUS SETUP STEP ───────────────────────────────────────────────────

export function createWizardScumStatusEmbed(config: ScumStatusConfig | undefined): EmbedBuilder {
  const channelVal  = config?.channel_id
    ? `<#${config.channel_id}>`
    : '⬜ *nicht gesetzt*';
  const serverVal   = config?.host && config?.query_port
    ? `${config.host}:${config.query_port}`
    : '⬜ *nicht konfiguriert*';
  const intervalVal = config ? `${config.update_interval_secs} Sekunden` : '60 Sekunden';

  let statusVal = '⚪ Nicht eingerichtet';
  if (config?.enabled && config.message_id)  statusVal = '✅ Aktiv';
  else if (config?.enabled && config.host)   statusVal = '⚙️ Konfiguriert (nicht gestartet)';
  else if (config && !config.enabled)        statusVal = '⏹️ Deaktiviert';

  const isConfigured = !!(config?.channel_id && config.host);

  return new EmbedBuilder()
    .setColor(isConfigured ? SECTOR_COLORS.MILITARY_GREEN : SECTOR_COLORS.SECTOR_RED)
    .setTitle('🖥️ SCUM-Server-Status')
    .setDescription(
      'Richte das automatische Server-Status-Dashboard ein. ' +
      'Der Bot postet eine Embed-Nachricht im gewählten Channel und aktualisiert sie regelmäßig.',
    )
    .addFields(
      { name: '📡 Status-Channel',           value: channelVal,  inline: true  },
      { name: '🌐 Server',                   value: serverVal,   inline: true  },
      { name: '🕐 Aktualisierungsintervall', value: intervalVal, inline: true  },
      { name: '⚡ Status',                   value: statusVal,   inline: false },
    )
    .setFooter({ text: 'SCUM-Server-Status • Bot einrichten' })
    .setTimestamp();
}

export function buildWizardScumStatusComponents(
  config: ScumStatusConfig | undefined,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const canCreate  = !!(config?.channel_id && config.host && config.query_port);
  const hasMessage = !!config?.message_id;
  const isEnabled  = !!(config?.enabled);

  return [
    new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('s:ss:channel')
        .setPlaceholder('📡 Status-Channel auswählen...')
        .setChannelTypes(ChannelType.GuildText),
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('ss:config')
        .setLabel('Server konfigurieren')
        .setEmoji('⚙️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('ss:interval')
        .setLabel('Intervall setzen')
        .setEmoji('🕐')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('s:step:0')
        .setLabel('Zurück')
        .setEmoji('◀')
        .setStyle(ButtonStyle.Secondary),
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('ss:create')
        .setLabel('Dashboard erstellen')
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!canCreate),
      new ButtonBuilder()
        .setCustomId('ss:recreate')
        .setLabel('Neu erstellen')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!hasMessage),
      new ButtonBuilder()
        .setCustomId('ss:disable')
        .setLabel('Deaktivieren')
        .setEmoji('⏹️')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!isEnabled),
    ) as unknown as ActionRowBuilder<MessageActionRowComponentBuilder>,
  ];
}
