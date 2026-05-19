// src/features/streamer/streamer.dashboard.ts
import type {
  ButtonInteraction, RoleSelectMenuInteraction,
  ChannelSelectMenuInteraction, StringSelectMenuInteraction,
  UserSelectMenuInteraction, ModalSubmitInteraction, Client,
} from 'discord.js';
import {
  EmbedBuilder,
  RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ActionRowBuilder,
  ChannelType,
} from 'discord.js';
import { replyError } from '../../utils/errors';
import { isAdmin } from '../../services/permissionService';
import {
  getStreamerConfig, upsertStreamerConfig, countStreamers,
  getAllStreamers, getStreamer, upsertStreamer,
  setStreamerEnabled, deleteStreamer, getLiveStatesForStreamer,
} from './streamer.db';
import { clearTwitchTokenCache } from './streamer.twitch';
import { startGuildInterval, stopGuildInterval } from './streamer.checker';
import {
  buildDashboardEmbed, buildDashboardComponents,
  buildSettingsMenuEmbed, buildSettingsMenuComponents,
  buildPlatformsMenuEmbed, buildPlatformsMenuComponents,
  buildManageMenuEmbed, buildManageMenuComponents,
  buildStreamerListEmbed, buildStreamerListComponents,
  buildPingMenuComponents, buildUserSelectComponents,
  buildStreamerSelectMenu, buildConfirmDeleteComponents,
  buildStreamerAddModal, buildStreamerEditModal,
  buildTwitchModal, buildYouTubeModal, buildIntervalModal,
  buildAnnouncementEmbed, buildAnnouncementComponents,
  sid,
} from './streamer.embeds';
import type { PingType, StreamLiveState } from './streamer.types';

const PAGE_SIZE = 10;

// ── Security helpers ───────────────────────────────────────────────────────────

/**
 * Parses a streamer dashboard payload after parseId() has already removed the "str" prefix.
 *
 * Custom ID formats (after "str:" prefix is stripped by parseId):
 *   Standard:    action_parts:GUILDID:USERID
 *   With page:   action_parts:GUILDID:USERID:PAGENUM    (PAGENUM is short digits, not a snowflake)
 *   With target: action_parts:GUILDID:USERID:TARGETID   (TARGETID is a Discord snowflake)
 *
 * Detection strategy: Discord snowflake IDs are 17-20 digit numbers.
 * - If the last segment is NOT a snowflake → it's a page number (extra)
 * - If the last segment IS a snowflake AND the third-from-last is also a snowflake → it's a targetId (extra)
 * - Otherwise → standard format, no extra
 */
function parseIds(payload: string): { action: string; guildId: string; userId: string; extra: string } {
  const parts = payload.split(':');
  const isSnowflake = (s: string) => /^\d{17,20}$/.test(s);

  const last = parts[parts.length - 1];

  if (!isSnowflake(last)) {
    // Non-snowflake at end = page number or similar extra
    const extra   = last;
    const userId  = parts[parts.length - 2];
    const guildId = parts[parts.length - 3];
    const action  = parts.slice(0, parts.length - 3).join(':');
    return { action, guildId, userId, extra };
  }

  // Last is a snowflake. Check if third-from-last is also a snowflake (targetId case).
  if (parts.length >= 4 && isSnowflake(parts[parts.length - 3])) {
    // Format: action:GUILDID:USERID:TARGETID
    const extra   = last;        // targetId
    const userId  = parts[parts.length - 2];
    const guildId = parts[parts.length - 3];
    const action  = parts.slice(0, parts.length - 3).join(':');
    return { action, guildId, userId, extra };
  }

  // Standard: action:GUILDID:USERID
  const userId  = parts[parts.length - 1];
  const guildId = parts[parts.length - 2];
  const action  = parts.slice(0, parts.length - 2).join(':');
  return { action, guildId, userId, extra: '' };
}

function securityCheck(interaction: { user: { id: string } }, userId: string): boolean {
  return interaction.user.id === userId;
}

async function rejectUnauthorized(
  interaction: ButtonInteraction | StringSelectMenuInteraction | UserSelectMenuInteraction | ModalSubmitInteraction,
): Promise<void> {
  await replyError(interaction as ButtonInteraction, 'Du hast dieses Dashboard nicht geöffnet.');
}

// ── Haupt-Dashboard neu rendern ────────────────────────────────────────────────

async function refreshDashboard(
  interaction: ButtonInteraction | RoleSelectMenuInteraction | ChannelSelectMenuInteraction | StringSelectMenuInteraction,
  guildId: string,
  userId: string,
): Promise<void> {
  const config = getStreamerConfig(guildId);
  if (!config) { await replyError(interaction as ButtonInteraction, 'Keine Konfiguration gefunden.'); return; }
  const counts = countStreamers(guildId);
  await interaction.update({
    embeds:     [buildDashboardEmbed(config, counts, interaction.guild!.name)],
    components: buildDashboardComponents(config, guildId, userId),
  });
}

// ── Button-Handler ─────────────────────────────────────────────────────────────

export async function handleDashboardButton(
  interaction: ButtonInteraction,
  payload: string,
  client: Client,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  if (!isAdmin(interaction.member)) { await replyError(interaction, 'Keine Berechtigung.'); return; }

  const { action, guildId, userId, extra } = parseIds(payload);
  if (!securityCheck(interaction, userId)) { await rejectUnauthorized(interaction); return; }

  // ── Dashboard-Aktionen ──

  if (action === 'dashboard:refresh') {
    await refreshDashboard(interaction, guildId, userId);
    return;
  }

  if (action === 'dashboard:toggle') {
    const config = getStreamerConfig(guildId);
    if (!config) { await replyError(interaction, 'Keine Konfiguration gefunden.'); return; }
    const newEnabled = config.enabled ? 0 : 1;
    upsertStreamerConfig(guildId, { enabled: newEnabled });
    if (newEnabled) startGuildInterval(client, guildId);
    else stopGuildInterval(guildId);
    await refreshDashboard(interaction, guildId, userId);
    return;
  }

  if (action === 'dashboard:settings') {
    await interaction.update({
      embeds:     [buildSettingsMenuEmbed()],
      components: buildSettingsMenuComponents(guildId, userId),
    });
    return;
  }

  if (action === 'dashboard:manage') {
    await interaction.update({
      embeds:     [buildManageMenuEmbed()],
      components: buildManageMenuComponents(guildId, userId),
    });
    return;
  }

  if (action === 'dashboard:platforms') {
    const config = getStreamerConfig(guildId);
    if (!config) { await replyError(interaction, 'Keine Konfiguration gefunden.'); return; }
    await interaction.update({
      embeds:     [buildPlatformsMenuEmbed()],
      components: buildPlatformsMenuComponents(config, guildId, userId),
    });
    return;
  }

  if (action === 'dashboard:test') {
    await handleTestAnnouncement(interaction, guildId, userId);
    return;
  }

  if (action === 'dashboard:list') {
    await handleStreamerList(interaction, guildId, userId, 0);
    return;
  }

  // ── Grundeinstellungen ──

  if (action === 'settings:role') {
    await interaction.update({
      embeds: [buildSettingsMenuEmbed()],
      components: [
        new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
          new RoleSelectMenuBuilder()
            .setCustomId(sid('settings:role_select', guildId, userId))
            .setPlaceholder('Neue Streamer-Rolle auswählen...'),
        ),
      ],
    });
    return;
  }

  if (action === 'settings:channel') {
    await interaction.update({
      embeds: [buildSettingsMenuEmbed()],
      components: [
        new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId(sid('settings:channel_select', guildId, userId))
            .setPlaceholder('Neuen Live-Channel auswählen...')
            .addChannelTypes(ChannelType.GuildText),
        ),
      ],
    });
    return;
  }

  if (action === 'settings:interval') {
    const config = getStreamerConfig(guildId);
    await interaction.showModal(buildIntervalModal(guildId, userId, config?.check_interval_seconds ?? 120, false));
    return;
  }

  if (action === 'settings:ping') {
    await interaction.update({
      embeds:     [buildSettingsMenuEmbed()],
      components: buildPingMenuComponents(guildId, userId),
    });
    return;
  }

  if (action.startsWith('settings:ping:')) {
    const subAction = action.split(':')[2];
    if (subAction === 'back') {
      await interaction.update({
        embeds:     [buildSettingsMenuEmbed()],
        components: buildSettingsMenuComponents(guildId, userId),
      });
    } else {
      upsertStreamerConfig(guildId, { announcement_ping_type: subAction as PingType });
      await refreshDashboard(interaction, guildId, userId);
    }
    return;
  }

  // ── Plattformen ──

  if (action === 'platforms:twitch') {
    await interaction.showModal(buildTwitchModal(guildId, userId, false));
    return;
  }

  if (action === 'platforms:youtube') {
    await interaction.showModal(buildYouTubeModal(guildId, userId, false));
    return;
  }

  if (action === 'platforms:youtube_disable') {
    upsertStreamerConfig(guildId, { youtube_api_key: null });
    await refreshDashboard(interaction, guildId, userId);
    return;
  }

  // ── Streamer verwalten ──

  if (action === 'manage:add') {
    await interaction.update({
      embeds:     [buildManageMenuEmbed()],
      components: buildUserSelectComponents(guildId, userId),
    });
    return;
  }

  if (action === 'manage:edit') {
    const streamers = getAllStreamers(guildId);
    if (streamers.length === 0) { await replyError(interaction, 'Keine Streamer gespeichert.'); return; }
    await interaction.update({
      embeds:     [buildManageMenuEmbed()],
      components: [buildStreamerSelectMenu(streamers, sid('manage:edit_select', guildId, userId), 'Streamer zum Bearbeiten auswählen...')],
    });
    return;
  }

  if (action === 'manage:disable') {
    const streamers = getAllStreamers(guildId).filter(s => s.enabled);
    if (streamers.length === 0) { await replyError(interaction, 'Keine aktiven Streamer vorhanden.'); return; }
    await interaction.update({
      embeds:     [buildManageMenuEmbed()],
      components: [buildStreamerSelectMenu(streamers, sid('manage:disable_select', guildId, userId), 'Streamer zum Deaktivieren auswählen...')],
    });
    return;
  }

  if (action === 'manage:enable') {
    const streamers = getAllStreamers(guildId).filter(s => !s.enabled);
    if (streamers.length === 0) { await replyError(interaction, 'Keine deaktivierten Streamer vorhanden.'); return; }
    await interaction.update({
      embeds:     [buildManageMenuEmbed()],
      components: [buildStreamerSelectMenu(streamers, sid('manage:enable_select', guildId, userId), 'Streamer aktivieren...')],
    });
    return;
  }

  if (action === 'manage:list') {
    // extra is the page number for pagination buttons (non-snowflake)
    const page = /^\d+$/.test(extra) ? parseInt(extra, 10) : 0;
    await handleStreamerList(interaction, guildId, userId, page);
    return;
  }

  if (action === 'manage:sync') {
    await handleSync(interaction, guildId, userId);
    return;
  }

  if (action === 'manage:back') {
    await interaction.update({
      embeds:     [buildManageMenuEmbed()],
      components: buildManageMenuComponents(guildId, userId),
    });
    return;
  }

  // NOTE: For confirm actions, `extra` contains the targetUserId (snowflake),
  // extracted by parseIds because it detects 3 consecutive snowflakes.
  if (action === 'manage:confirm_disable') {
    setStreamerEnabled(guildId, extra, false);
    await interaction.update({ embeds: [buildManageMenuEmbed()], components: buildManageMenuComponents(guildId, userId) });
    return;
  }

  if (action === 'manage:confirm_delete') {
    deleteStreamer(guildId, extra);
    await interaction.update({ embeds: [buildManageMenuEmbed()], components: buildManageMenuComponents(guildId, userId) });
    return;
  }
}

// ── Streamer-Liste ─────────────────────────────────────────────────────────────

async function handleStreamerList(
  interaction: ButtonInteraction,
  guildId: string,
  userId: string,
  page: number,
): Promise<void> {
  const config     = getStreamerConfig(guildId);
  const streamers  = getAllStreamers(guildId);
  const total      = streamers.length;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const pageData   = streamers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const liveStatesMap = new Map<string, StreamLiveState[]>();
  for (const s of pageData) {
    liveStatesMap.set(s.discord_user_id, getLiveStatesForStreamer(guildId, s.discord_user_id));
  }

  const roleIds = new Set<string>();
  if (config?.streamer_role_id) {
    try {
      const guild = interaction.guild!;
      const role  = await guild.roles.fetch(config.streamer_role_id).catch(() => null);
      if (role) role.members.forEach(m => roleIds.add(m.id));
    } catch { /* best-effort */ }
  }

  await interaction.update({
    embeds:     [buildStreamerListEmbed(pageData, liveStatesMap, roleIds, page, totalPages)],
    components: buildStreamerListComponents(page, totalPages, guildId, userId),
  });
}

// ── Test-Announcement ─────────────────────────────────────────────────────────

async function handleTestAnnouncement(
  interaction: ButtonInteraction,
  guildId: string,
  userId: string,
): Promise<void> {
  const config = getStreamerConfig(guildId);
  if (!config?.live_channel_id) {
    await replyError(interaction, 'Kein Live-Channel konfiguriert.');
    return;
  }

  const channel = await interaction.guild!.channels.fetch(config.live_channel_id).catch(() => null);
  if (!channel?.isTextBased()) {
    await replyError(interaction, 'Live-Channel nicht gefunden oder ungültig.');
    return;
  }

  await interaction.deferUpdate();

  const testResult = {
    isLive: true, streamId: 'test', title: 'Teststream — Alles funktioniert!',
    gameName: 'SCUM', viewerCount: 42, userName: 'TestStreamer',
    url: 'https://twitch.tv/test', thumbnailUrl: undefined,
  };

  const embed      = buildAnnouncementEmbed(testResult, 'twitch', true);
  const components = buildAnnouncementComponents(testResult.url);
  await channel.send({ content: '[TEST]', embeds: [embed], components });

  const counts = countStreamers(guildId);
  await interaction.editReply({
    embeds:     [buildDashboardEmbed(config, counts, interaction.guild!.name)],
    components: buildDashboardComponents(config, guildId, userId),
  });
}

// ── Sync ──────────────────────────────────────────────────────────────────────

async function handleSync(
  interaction: ButtonInteraction,
  guildId: string,
  userId: string,
): Promise<void> {
  const config = getStreamerConfig(guildId);
  if (!config?.streamer_role_id) { await replyError(interaction, 'Keine Streamer-Rolle konfiguriert.'); return; }

  await interaction.deferUpdate();

  const guild = interaction.guild!;
  const role  = await guild.roles.fetch(config.streamer_role_id).catch(() => null);
  if (!role) {
    await interaction.editReply({ content: 'Streamer-Rolle nicht gefunden.', embeds: [], components: [] });
    return;
  }

  const existing   = new Set(getAllStreamers(guildId).map(s => s.discord_user_id));
  const newMembers = role.members.filter(m => !existing.has(m.id));

  if (newMembers.size === 0) {
    const counts = countStreamers(guildId);
    await interaction.editReply({
      embeds:     [buildDashboardEmbed(config, counts, guild.name)],
      components: buildDashboardComponents(config, guildId, userId),
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🔄 Sync: Neue Rollenmitglieder')
    .setDescription(
      `Folgende Mitglieder haben die Streamer-Rolle, sind aber noch nicht eingetragen:\n` +
      newMembers.map(m => `• <@${m.id}>`).join('\n') +
      `\n\nFüge sie einzeln über **Streamer hinzufügen** ein.`,
    );

  const counts = countStreamers(guildId);
  await interaction.editReply({
    embeds:     [embed, buildDashboardEmbed(config, counts, guild.name)],
    components: buildDashboardComponents(config, guildId, userId),
  });
}

// ── Role Select (Settings) ─────────────────────────────────────────────────────

export async function handleDashboardRoleSelect(
  interaction: RoleSelectMenuInteraction,
  payload: string,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  if (!isAdmin(interaction.member)) { await replyError(interaction, 'Keine Berechtigung.'); return; }
  const parts   = payload.split(':');
  const userId  = parts[parts.length - 1];
  const guildId = parts[parts.length - 2];
  if (!securityCheck(interaction, userId)) { await replyError(interaction, 'Du hast dieses Dashboard nicht geöffnet.'); return; }
  const role = interaction.roles.first();
  if (!role) { await replyError(interaction, 'Keine Rolle ausgewählt.'); return; }
  upsertStreamerConfig(guildId, { streamer_role_id: role.id });
  await refreshDashboard(interaction, guildId, userId);
}

// ── Channel Select (Settings) ──────────────────────────────────────────────────

export async function handleDashboardChannelSelect(
  interaction: ChannelSelectMenuInteraction,
  payload: string,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  if (!isAdmin(interaction.member)) { await replyError(interaction, 'Keine Berechtigung.'); return; }
  const parts   = payload.split(':');
  const userId  = parts[parts.length - 1];
  const guildId = parts[parts.length - 2];
  if (!securityCheck(interaction, userId)) { await replyError(interaction, 'Du hast dieses Dashboard nicht geöffnet.'); return; }
  const channel = interaction.channels.first();
  if (!channel) { await replyError(interaction, 'Kein Channel ausgewählt.'); return; }
  upsertStreamerConfig(guildId, { live_channel_id: channel.id });
  await refreshDashboard(interaction, guildId, userId);
}

// ── String Select (Edit/Disable/Enable Streamer) ──────────────────────────────

export async function handleDashboardStringSelect(
  interaction: StringSelectMenuInteraction,
  payload: string,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  if (!isAdmin(interaction.member)) { await replyError(interaction, 'Keine Berechtigung.'); return; }
  const parts   = payload.split(':');
  const userId  = parts[parts.length - 1];
  const guildId = parts[parts.length - 2];
  const action  = parts.slice(0, parts.length - 2).join(':');
  if (!securityCheck(interaction, userId)) { await rejectUnauthorized(interaction); return; }

  const targetId = interaction.values[0];

  if (action === 'manage:edit_select') {
    const streamer = getStreamer(guildId, targetId);
    if (!streamer) { await replyError(interaction, 'Streamer nicht gefunden.'); return; }
    await interaction.showModal(buildStreamerEditModal(guildId, userId, streamer));
    return;
  }

  if (action === 'manage:disable_select') {
    const embed = new EmbedBuilder().setTitle('Streamer deaktivieren/löschen?').setDescription(`<@${targetId}>`);
    await interaction.update({
      embeds:     [embed],
      components: buildConfirmDeleteComponents(guildId, userId, targetId),
    });
    return;
  }

  if (action === 'manage:enable_select') {
    setStreamerEnabled(guildId, targetId, true);
    await interaction.update({ embeds: [buildManageMenuEmbed()], components: buildManageMenuComponents(guildId, userId) });
    return;
  }
}

// ── User Select (Streamer hinzufügen) ─────────────────────────────────────────

export async function handleDashboardUserSelect(
  interaction: UserSelectMenuInteraction,
  payload: string,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  if (!isAdmin(interaction.member)) { await replyError(interaction, 'Keine Berechtigung.'); return; }
  const parts   = payload.split(':');
  const userId  = parts[parts.length - 1];
  const guildId = parts[parts.length - 2];
  if (!securityCheck(interaction, userId)) { await replyError(interaction, 'Du hast dieses Dashboard nicht geöffnet.'); return; }

  const targetUser = interaction.users.first();
  if (!targetUser) { await replyError(interaction, 'Keinen User ausgewählt.'); return; }
  if (targetUser.bot) { await replyError(interaction, 'Bots können nicht als Streamer eingetragen werden.'); return; }

  await interaction.showModal(buildStreamerAddModal(guildId, userId, targetUser.id));
}

// ── Modal Submissions (Settings & Manage) ─────────────────────────────────────

export async function handleDashboardModal(
  interaction: ModalSubmitInteraction,
  payload: string,
  client: Client,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  if (!isAdmin(interaction.member)) { await replyError(interaction, 'Keine Berechtigung.'); return; }

  // payload format: "modal:TYPE:GUILDID:USERID[:EXTRA]"
  const parts     = payload.split(':');
  const modalType = parts[1];
  const guildId   = parts[2];
  const userId    = parts[3];
  const extra     = parts[4] ?? '';

  if (!securityCheck(interaction, userId)) { await rejectUnauthorized(interaction); return; }

  if (modalType === 'twitch_settings') {
    const clientId     = interaction.fields.getTextInputValue('client_id').trim();
    const clientSecret = interaction.fields.getTextInputValue('client_secret').trim();
    upsertStreamerConfig(guildId, { twitch_client_id: clientId, twitch_client_secret: clientSecret });
    clearTwitchTokenCache(guildId);
    const config = getStreamerConfig(guildId)!;
    const counts = countStreamers(guildId);
    await interaction.reply({
      embeds:     [buildDashboardEmbed(config, counts, interaction.guild!.name)],
      components: buildDashboardComponents(config, guildId, userId),
      ephemeral:  true,
    });
    return;
  }

  if (modalType === 'youtube_settings') {
    const apiKey = interaction.fields.getTextInputValue('api_key').trim();
    upsertStreamerConfig(guildId, { youtube_api_key: apiKey });
    const config = getStreamerConfig(guildId)!;
    const counts = countStreamers(guildId);
    await interaction.reply({
      embeds:     [buildDashboardEmbed(config, counts, interaction.guild!.name)],
      components: buildDashboardComponents(config, guildId, userId),
      ephemeral:  true,
    });
    return;
  }

  if (modalType === 'interval_settings') {
    const raw  = interaction.fields.getTextInputValue('interval_secs').trim();
    const secs = parseInt(raw, 10);
    if (isNaN(secs) || secs < 60) { await replyError(interaction, 'Ungültiger Wert. Minimum: 60 Sekunden.'); return; }
    upsertStreamerConfig(guildId, { check_interval_seconds: secs });
    startGuildInterval(client, guildId);
    const config = getStreamerConfig(guildId)!;
    const counts = countStreamers(guildId);
    await interaction.reply({
      embeds:     [buildDashboardEmbed(config, counts, interaction.guild!.name)],
      components: buildDashboardComponents(config, guildId, userId),
      ephemeral:  true,
    });
    return;
  }

  if (modalType === 'streamer_add') {
    const targetUserId     = extra;
    const twitchUsername   = interaction.fields.getTextInputValue('twitch_username').trim() || null;
    const youtubeChannelId = interaction.fields.getTextInputValue('youtube_channel_id').trim() || null;

    if (!twitchUsername && !youtubeChannelId) {
      await replyError(interaction, 'Mindestens eine Plattform (Twitch oder YouTube) muss angegeben werden.');
      return;
    }

    upsertStreamer(guildId, targetUserId, { twitch_username: twitchUsername, youtube_channel_id: youtubeChannelId });

    const config  = getStreamerConfig(guildId);
    const hasRole = config?.streamer_role_id
      ? interaction.guild!.members.cache.get(targetUserId)?.roles.cache.has(config.streamer_role_id) ?? false
      : false;

    const confirmEmbed = new EmbedBuilder()
      .setTitle('✅ Streamer gespeichert')
      .setDescription(
        `<@${targetUserId}> wurde als Streamer eingetragen.` +
        (hasRole ? '' : '\n\n⚠️ Dieser User hat die Streamer-Rolle noch nicht — er wird erst überwacht, wenn die Rolle vergeben wurde.'),
      );

    await interaction.reply({
      embeds:     [confirmEmbed, buildManageMenuEmbed()],
      components: buildManageMenuComponents(guildId, userId),
      ephemeral:  true,
    });
    return;
  }

  if (modalType === 'streamer_edit') {
    const targetUserId     = extra;
    const twitchUsername   = interaction.fields.getTextInputValue('twitch_username').trim() || null;
    const youtubeChannelId = interaction.fields.getTextInputValue('youtube_channel_id').trim() || null;

    upsertStreamer(guildId, targetUserId, {
      twitch_username:    twitchUsername,
      youtube_channel_id: youtubeChannelId,
    });

    await interaction.reply({
      embeds:     [buildManageMenuEmbed()],
      components: buildManageMenuComponents(guildId, userId),
      ephemeral:  true,
    });
    return;
  }
}
