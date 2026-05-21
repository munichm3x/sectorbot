// src/features/streamer/streamer.embeds.ts
import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  RoleSelectMenuBuilder, ChannelSelectMenuBuilder,
  UserSelectMenuBuilder, StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder, ChannelType,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { SECTOR_COLORS, BRAND } from '../../ui/brand';
import type { StreamerConfig, Streamer, StreamLiveState, WizardState, LiveResult, PingType } from './streamer.types';

const PREFIX = 'str';

export function sid(action: string, guildId: string, userId: string, extra = ''): string {
  return extra
    ? `${PREFIX}:${action}:${guildId}:${userId}:${extra}`
    : `${PREFIX}:${action}:${guildId}:${userId}`;
}

// ── Wizard Embeds ──────────────────────────────────────────────────────────────

export function buildWizardEmbed(step: number, total: number, title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.MILITARY_GREEN)
    .setTitle(`⚙️ Streamer-Setup — Schritt ${step}/${total}: ${title}`)
    .setDescription(description)
    .setFooter({ text: BRAND.FOOTER });
}

export function buildWizardStep1(guildId: string, userId: string): {
  embeds: [EmbedBuilder]; components: [ActionRowBuilder<RoleSelectMenuBuilder>];
} {
  return {
    embeds: [buildWizardEmbed(1, 7, 'Streamer-Rolle', 'Wähle die Rolle, die Streamer auf diesem Server erhalten.')],
    components: [
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId(sid('wizard:role', guildId, userId))
          .setPlaceholder('🎭 Streamer-Rolle auswählen...'),
      ),
    ],
  };
}

export function buildWizardStep2(guildId: string, userId: string): {
  embeds: [EmbedBuilder]; components: [ActionRowBuilder<ChannelSelectMenuBuilder>];
} {
  return {
    embeds: [buildWizardEmbed(2, 7, 'Live-Channel', 'Wähle den Channel für Live-Ankündigungen.')],
    components: [
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(sid('wizard:channel', guildId, userId))
          .setPlaceholder('📢 Live-Announcement-Channel auswählen...')
          .addChannelTypes(ChannelType.GuildText),
      ),
    ],
  };
}

export function buildWizardStep3(guildId: string, userId: string): {
  embeds: [EmbedBuilder]; components: [ActionRowBuilder<ButtonBuilder>];
} {
  return {
    embeds: [buildWizardEmbed(3, 7, 'Twitch API', 'Trage deine Twitch API-Zugangsdaten ein.\nDiese gelten für alle Streamer auf diesem Server.')],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(sid('wizard:twitch_modal', guildId, userId))
          .setLabel('🟣 Twitch-Daten eintragen')
          .setStyle(ButtonStyle.Primary),
      ),
    ],
  };
}

export function buildWizardStep4(guildId: string, userId: string): {
  embeds: [EmbedBuilder]; components: [ActionRowBuilder<ButtonBuilder>];
} {
  return {
    embeds: [buildWizardEmbed(4, 7, 'YouTube API (optional)', 'YouTube-Integration ist optional.\nWenn du keinen API-Key hast, klicke Überspringen.')],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(sid('wizard:youtube_modal', guildId, userId))
          .setLabel('🔴 YouTube-Key eintragen')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(sid('wizard:youtube_skip', guildId, userId))
          .setLabel('Überspringen')
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
  };
}

export function buildWizardStep5(guildId: string, userId: string): {
  embeds: [EmbedBuilder]; components: [ActionRowBuilder<ButtonBuilder>];
} {
  return {
    embeds: [buildWizardEmbed(5, 7, 'Prüf-Intervall', 'Wie oft soll der Bot live-Status prüfen?\nStandard: 120 Sekunden (Minimum: 60).')],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(sid('wizard:interval_modal', guildId, userId))
          .setLabel('⏱ Intervall setzen')
          .setStyle(ButtonStyle.Primary),
      ),
    ],
  };
}

export function buildWizardStep6(guildId: string, userId: string): {
  embeds: [EmbedBuilder]; components: [ActionRowBuilder<ButtonBuilder>];
} {
  return {
    embeds: [buildWizardEmbed(6, 7, 'Ping-Typ', 'Wer soll gepingt werden, wenn ein Streamer live geht?')],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(sid('wizard:ping:role', guildId, userId)).setLabel('Streamer-Rolle').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(sid('wizard:ping:everyone', guildId, userId)).setLabel('@everyone').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(sid('wizard:ping:here', guildId, userId)).setLabel('@here').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(sid('wizard:ping:none', guildId, userId)).setLabel('Kein Ping').setStyle(ButtonStyle.Secondary),
      ),
    ],
  };
}

export function buildWizardStep7(
  guildId: string, userId: string, state: WizardState, guildName: string,
): { embeds: [EmbedBuilder]; components: [ActionRowBuilder<ButtonBuilder>] } {
  const pingLabels: Record<PingType, string> = {
    none: 'Kein Ping', role: 'Streamer-Rolle', everyone: '@everyone', here: '@here',
  };
  const embed = new EmbedBuilder()
    .setColor(SECTOR_COLORS.MILITARY_GREEN)
    .setTitle('⚙️ Streamer-Setup — Zusammenfassung')
    .setDescription('Überprüfe deine Einstellungen und schließe das Setup ab.')
    .addFields(
      { name: '🎭 Streamer-Rolle',    value: state.streamer_role_id ? `<@&${state.streamer_role_id}>` : '—', inline: true },
      { name: '📢 Live-Channel',      value: state.live_channel_id  ? `<#${state.live_channel_id}>` : '—',   inline: true },
      { name: '🟣 Twitch',            value: state.twitch_client_id  ? '✅ Eingerichtet' : '❌ Fehlt',         inline: true },
      { name: '🔴 YouTube',           value: state.youtube_api_key   ? '✅ Eingerichtet' : '⏭ Übersprungen',  inline: true },
      { name: '⏱ Intervall',         value: `${state.check_interval_seconds ?? 120} Sekunden`,               inline: true },
      { name: '🔔 Ping',             value: pingLabels[state.announcement_ping_type ?? 'none'],              inline: true },
    )
    .setFooter({ text: BRAND.FOOTER });
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(sid('wizard:finish:enabled', guildId, userId)).setLabel('✅ Aktivieren & Abschließen').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(sid('wizard:finish:disabled', guildId, userId)).setLabel('💾 Deaktiviert speichern').setStyle(ButtonStyle.Secondary),
      ),
    ],
  };
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export function buildDashboardEmbed(config: StreamerConfig, counts: { total: number; active: number }, guildName: string): EmbedBuilder {
  const pingLabels: Record<PingType, string> = {
    none: 'Kein Ping', role: 'Streamer-Rolle', everyone: '@everyone', here: '@here',
  };
  const statusColor = config.enabled ? SECTOR_COLORS.ONLINE_GREEN : SECTOR_COLORS.OFFLINE_RED;
  const statusText  = config.enabled ? '🟢 Aktiv' : '🔴 Inaktiv';

  return new EmbedBuilder()
    .setColor(statusColor)
    .setTitle(`🖥️ Streamer-System — ${guildName}`)
    .addFields(
      { name: 'Status',              value: statusText,                                                                   inline: true },
      { name: '🎭 Streamer-Rolle',   value: config.streamer_role_id ? `<@&${config.streamer_role_id}>` : '❌ Nicht gesetzt', inline: true },
      { name: '📢 Live-Channel',     value: config.live_channel_id  ? `<#${config.live_channel_id}>` : '❌ Nicht gesetzt',  inline: true },
      { name: '⏱ Intervall',        value: `${config.check_interval_seconds}s`,                                          inline: true },
      { name: '🔔 Ping',            value: pingLabels[config.announcement_ping_type],                                    inline: true },
      { name: '🟣 Twitch',          value: config.twitch_client_id  ? '✅ Verbunden' : '❌ Nicht eingerichtet',            inline: true },
      { name: '🔴 YouTube',         value: config.youtube_api_key   ? '✅ Verbunden' : '❌ Nicht eingerichtet',            inline: true },
      { name: '👥 Streamer',        value: `${counts.total} gespeichert / ${counts.active} aktiv`,                       inline: true },
      { name: '🕐 Letzter Check',   value: config.last_successful_check ? `<t:${Math.floor(new Date(config.last_successful_check).getTime() / 1000)}:R>` : '—', inline: true },
      { name: '⚠️ Letzter Fehler',  value: config.last_error ?? '—', inline: false },
    )
    .setFooter({ text: BRAND.FOOTER })
    .setTimestamp();
}

export function buildDashboardComponents(config: StreamerConfig, guildId: string, userId: string): ActionRowBuilder<ButtonBuilder>[] {
  const toggleLabel = config.enabled ? '🔴 System deaktivieren' : '🟢 System aktivieren';
  const toggleStyle = config.enabled ? ButtonStyle.Danger : ButtonStyle.Success;
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(sid('dashboard:toggle', guildId, userId)).setLabel(toggleLabel).setStyle(toggleStyle),
      new ButtonBuilder().setCustomId(sid('dashboard:settings', guildId, userId)).setLabel('⚙️ Grundeinstellungen').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('dashboard:manage', guildId, userId)).setLabel('👥 Streamer verwalten').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('dashboard:platforms', guildId, userId)).setLabel('🔧 Plattformen/API').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(sid('dashboard:test', guildId, userId)).setLabel('📢 Testnachricht').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('dashboard:list', guildId, userId)).setLabel('📋 Streamer-Liste').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('dashboard:refresh', guildId, userId)).setLabel('🔄 Aktualisieren').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

// ── Untermenü-Embeds ───────────────────────────────────────────────────────────

export function buildSettingsMenuEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.STEEL)
    .setTitle('⚙️ Grundeinstellungen')
    .setDescription('Wähle eine Einstellung zum Ändern.')
    .setFooter({ text: BRAND.FOOTER });
}

export function buildSettingsMenuComponents(guildId: string, userId: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(sid('settings:role', guildId, userId)).setLabel('🎭 Streamer-Rolle ändern').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('settings:channel', guildId, userId)).setLabel('📢 Live-Channel ändern').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('settings:interval', guildId, userId)).setLabel('⏱ Intervall ändern').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(sid('settings:ping', guildId, userId)).setLabel('🔔 Ping-Typ ändern').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('dashboard:refresh', guildId, userId)).setLabel('↩ Zurück').setStyle(ButtonStyle.Primary),
    ),
  ];
}

export function buildPingMenuComponents(guildId: string, userId: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(sid('settings:ping:role', guildId, userId)).setLabel('Streamer-Rolle').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('settings:ping:everyone', guildId, userId)).setLabel('@everyone').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('settings:ping:here', guildId, userId)).setLabel('@here').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('settings:ping:none', guildId, userId)).setLabel('Kein Ping').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('settings:ping:back', guildId, userId)).setLabel('↩ Zurück').setStyle(ButtonStyle.Primary),
    ),
  ];
}

export function buildPlatformsMenuEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.STEEL)
    .setTitle('🔧 Plattformen & API-Verwaltung')
    .setDescription('API-Zugangsdaten werden **niemals** angezeigt.\n`[GESETZT]` bedeutet: ein Wert ist eingetragen.')
    .setFooter({ text: BRAND.FOOTER });
}

export function buildPlatformsMenuComponents(config: StreamerConfig, guildId: string, userId: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(sid('platforms:twitch', guildId, userId)).setLabel('🟣 Twitch API ändern').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('platforms:youtube', guildId, userId)).setLabel('🔴 YouTube API ändern').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('platforms:youtube_disable', guildId, userId)).setLabel('YouTube deaktivieren').setStyle(ButtonStyle.Danger).setDisabled(!config.youtube_api_key),
      new ButtonBuilder().setCustomId(sid('dashboard:refresh', guildId, userId)).setLabel('↩ Zurück').setStyle(ButtonStyle.Primary),
    ),
  ];
}

export function buildManageMenuEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(SECTOR_COLORS.STEEL)
    .setTitle('👥 Streamer verwalten')
    .setDescription('Verwalte die gespeicherten Streamer.')
    .setFooter({ text: BRAND.FOOTER });
}

export function buildManageMenuComponents(guildId: string, userId: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(sid('manage:add', guildId, userId)).setLabel('➕ Hinzufügen').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(sid('manage:edit', guildId, userId)).setLabel('✏️ Bearbeiten').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('manage:disable', guildId, userId)).setLabel('🚫 Deaktivieren').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(sid('manage:enable', guildId, userId)).setLabel('✅ Aktivieren').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('manage:list', guildId, userId)).setLabel('📋 Liste').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('manage:sync', guildId, userId)).setLabel('🔄 Sync').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('dashboard:refresh', guildId, userId)).setLabel('↩ Zurück').setStyle(ButtonStyle.Primary),
    ),
  ];
}

// ── Streamer-Liste (paginiert) ─────────────────────────────────────────────────

export function buildStreamerListEmbed(
  streamers: Streamer[],
  liveStatesMap: Map<string, StreamLiveState[]>,
  roleIds: Set<string>,
  page: number,
  totalPages: number,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(SECTOR_COLORS.STEEL)
    .setTitle(`📋 Streamer-Liste (Seite ${page + 1}/${totalPages || 1})`)
    .setFooter({ text: BRAND.FOOTER });

  if (streamers.length === 0) {
    embed.setDescription('Keine Streamer gespeichert.');
    return embed;
  }

  for (const s of streamers) {
    const states = liveStatesMap.get(s.discord_user_id) ?? [];
    const twitchState = states.find(st => st.platform === 'twitch');
    const ytState     = states.find(st => st.platform === 'youtube');
    const hasRole     = roleIds.has(s.discord_user_id);
    const liveTag     = (twitchState?.is_live || ytState?.is_live) ? ' 🔴 LIVE' : '';

    embed.addFields({
      name: `<@${s.discord_user_id}>${liveTag}`,
      value: [
        `🟣 Twitch: ${s.twitch_username ?? '—'}`,
        `🔴 YouTube: ${s.youtube_channel_id ? '✅' : '—'}`,
        `🎭 Rolle: ${hasRole ? '✅' : '❌'}`,
        `Aktiv: ${s.enabled ? '✅' : '🚫'}`,
      ].join('  ·  '),
      inline: false,
    });
  }

  return embed;
}

export function buildStreamerListComponents(
  page: number, totalPages: number, guildId: string, userId: string,
): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      // Use distinct action names for prev/next to avoid duplicate custom IDs
      // when both are disabled (e.g. single page: both would resolve to page 0).
      new ButtonBuilder().setCustomId(sid('manage:list_prev', guildId, userId, String(page))).setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
      new ButtonBuilder().setCustomId(sid('manage:list_next', guildId, userId, String(page))).setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1),
      new ButtonBuilder().setCustomId(sid('dashboard:refresh', guildId, userId)).setLabel('↩ Dashboard').setStyle(ButtonStyle.Primary),
    ),
  ];
}

// ── Offline-Embed ──────────────────────────────────────────────────────────────

export function buildOfflineEmbed(
  state: Pick<StreamLiveState, 'last_live_title' | 'last_live_url'>,
  platform: 'twitch' | 'youtube',
  userName: string,
): EmbedBuilder {
  const platformLabel = platform === 'twitch' ? 'Twitch' : 'YouTube';
  const embed = new EmbedBuilder()
    .setColor(SECTOR_COLORS.OFFLINE_RED)
    .setTitle(`⬛ ${userName} ist nicht mehr live auf ${platformLabel}`)
    .setTimestamp();

  const desc: string[] = ['Der Stream wurde beendet.'];
  if (state.last_live_title) desc.push(`**Zuletzt gespielt:** ${state.last_live_title}`);
  embed.setDescription(desc.join('\n'));

  return embed;
}

// ── Announcement-Embed ─────────────────────────────────────────────────────────

export function buildAnnouncementEmbed(
  result: LiveResult,
  platform: 'twitch' | 'youtube',
  isTest = false,
): EmbedBuilder {
  const platformLabel = platform === 'twitch' ? 'Twitch' : 'YouTube';
  const prefix = isTest ? '[TEST] ' : '';
  const embed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle(`${prefix}🔴 ${result.userName ?? 'Unbekannt'} ist jetzt live auf ${platformLabel}`)
    .setTimestamp();

  const desc: string[] = [];
  if (result.title)      desc.push(`**${result.title}**`);
  if (result.gameName)   desc.push(`🎮 ${result.gameName}`);
  if (result.viewerCount !== undefined) desc.push(`👥 ${result.viewerCount.toLocaleString('de-DE')} Zuschauer`);
  if (desc.length) embed.setDescription(desc.join('\n'));

  if (result.thumbnailUrl) embed.setImage(result.thumbnailUrl);

  return embed;
}

export function buildAnnouncementComponents(url: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setLabel('🔗 Zum Stream').setStyle(ButtonStyle.Link).setURL(url),
    ),
  ];
}

// ── Modals ─────────────────────────────────────────────────────────────────────

export function buildTwitchModal(guildId: string, userId: string, isWizard = true): ModalBuilder {
  const customId = isWizard ? sid('modal:twitch_wizard', guildId, userId) : sid('modal:twitch_settings', guildId, userId);
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle('Twitch API-Zugangsdaten')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('client_id').setLabel('Twitch Client ID').setStyle(TextInputStyle.Short).setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('client_secret').setLabel('Twitch Client Secret').setStyle(TextInputStyle.Short).setRequired(true),
      ),
    );
}

export function buildYouTubeModal(guildId: string, userId: string, isWizard = true): ModalBuilder {
  const customId = isWizard ? sid('modal:youtube_wizard', guildId, userId) : sid('modal:youtube_settings', guildId, userId);
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle('YouTube API-Key')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('api_key').setLabel('YouTube Data API v3 Key').setStyle(TextInputStyle.Short).setRequired(true),
      ),
    );
}

export function buildIntervalModal(guildId: string, userId: string, current: number, isWizard = true): ModalBuilder {
  const customId = isWizard ? sid('modal:interval_wizard', guildId, userId) : sid('modal:interval_settings', guildId, userId);
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle('Prüf-Intervall setzen')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('interval_secs')
          .setLabel('Intervall in Sekunden (Minimum: 60)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setValue(String(current)),
      ),
    );
}

export function buildStreamerAddModal(guildId: string, userId: string, targetUserId: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(sid('modal:streamer_add', guildId, userId, targetUserId))
    .setTitle('Streamer-Plattformen')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('twitch_username').setLabel('Twitch Username (optional)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('z.B. dein_twitch_name'),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('youtube_channel_id').setLabel('YouTube Channel-ID (optional)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('z.B. UCxxxxxxx'),
      ),
    );
}

export function buildStreamerEditModal(guildId: string, userId: string, streamer: Streamer): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(sid('modal:streamer_edit', guildId, userId, streamer.discord_user_id))
    .setTitle('Streamer bearbeiten')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('twitch_username')
          .setLabel('Twitch Username (leer = unverändert)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(streamer.twitch_username ?? ''),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('youtube_channel_id')
          .setLabel('YouTube Channel-ID (leer = unverändert)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(streamer.youtube_channel_id ?? ''),
      ),
    );
}

// ── Streamer-Select-Menüs ──────────────────────────────────────────────────────

export function buildStreamerSelectMenu(
  streamers: Streamer[],
  customId: string,
  placeholder: string,
): ActionRowBuilder<StringSelectMenuBuilder> {
  const options = streamers.slice(0, 25).map(s =>
    new StringSelectMenuOptionBuilder()
      .setValue(s.discord_user_id)
      .setLabel(s.discord_user_id.slice(0, 100))
      .setDescription(`Twitch: ${s.twitch_username ?? '—'} | YT: ${s.youtube_channel_id ? '✅' : '—'}`.slice(0, 100)),
  );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).addOptions(options),
  );
}

export function buildConfirmDeleteComponents(
  guildId: string, userId: string, targetUserId: string,
): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(sid('manage:confirm_disable', guildId, userId, targetUserId)).setLabel('🚫 Deaktivieren').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(sid('manage:confirm_delete', guildId, userId, targetUserId)).setLabel('🗑️ Komplett löschen').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(sid('manage:back', guildId, userId)).setLabel('Abbrechen').setStyle(ButtonStyle.Primary),
    ),
  ];
}

// ── User-Select für Streamer-Hinzufügen ───────────────────────────────────────

export function buildUserSelectComponents(guildId: string, userId: string): ActionRowBuilder<UserSelectMenuBuilder | ButtonBuilder>[] {
  return [
    new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(sid('manage:user_select', guildId, userId))
        .setPlaceholder('Discord-User auswählen...'),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(sid('manage:back', guildId, userId)).setLabel('↩ Abbrechen').setStyle(ButtonStyle.Secondary),
    ),
  ];
}
