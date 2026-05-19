// src/features/streamer/streamer.wizard.ts
import type { ButtonInteraction, RoleSelectMenuInteraction, ChannelSelectMenuInteraction, ModalSubmitInteraction } from 'discord.js';
import { replyError } from '../../utils/errors';
import { upsertStreamerConfig, getStreamerConfig, countStreamers } from './streamer.db';
import { clearTwitchTokenCache } from './streamer.twitch';
import {
  buildWizardStep2, buildWizardStep3, buildWizardStep4,
  buildWizardStep5, buildWizardStep6, buildWizardStep7,
  buildDashboardEmbed, buildDashboardComponents,
  buildTwitchModal, buildYouTubeModal, buildIntervalModal,
} from './streamer.embeds';
import type { WizardState, PingType } from './streamer.types';

// ── Wizard-State (In-Memory, 30-min TTL) ──────────────────────────────────────

const wizardStates = new Map<string, WizardState>();
const WIZARD_TTL_MS = 30 * 60 * 1000;

function wizardKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

export function getWizardState(guildId: string, userId: string): WizardState | null {
  const state = wizardStates.get(wizardKey(guildId, userId));
  if (!state) return null;
  if (Date.now() > state.expiresAt) { wizardStates.delete(wizardKey(guildId, userId)); return null; }
  return state;
}

export function setWizardState(guildId: string, userId: string, state: Partial<WizardState>): WizardState {
  const existing = getWizardState(guildId, userId) ?? { step: 1, expiresAt: 0 };
  const updated: WizardState = { ...existing, ...state, expiresAt: Date.now() + WIZARD_TTL_MS };
  wizardStates.set(wizardKey(guildId, userId), updated);
  return updated;
}

export function clearWizardState(guildId: string, userId: string): void {
  wizardStates.delete(wizardKey(guildId, userId));
}

// ── Security-Check ─────────────────────────────────────────────────────────────

export function checkWizardOwner(interaction: { user: { id: string } }, userId: string): boolean {
  return interaction.user.id === userId;
}

// ── Role Select — Step 1 → 2 ─────────────────────────────────────────────────

export async function handleWizardRoleSelect(
  interaction: RoleSelectMenuInteraction,
  payload: string,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  const { guildId, userId } = parseWizardIds(payload);
  if (!checkWizardOwner(interaction, userId)) {
    await replyError(interaction, 'Du hast diesen Wizard nicht geöffnet.');
    return;
  }

  const role = interaction.roles.first();
  if (!role) { await replyError(interaction, 'Keine Rolle ausgewählt.'); return; }

  setWizardState(guildId, userId, { step: 2, streamer_role_id: role.id });
  await interaction.update(buildWizardStep2(guildId, userId));
}

// ── Channel Select — Step 2 → 3 ──────────────────────────────────────────────

export async function handleWizardChannelSelect(
  interaction: ChannelSelectMenuInteraction,
  payload: string,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  const { guildId, userId } = parseWizardIds(payload);
  if (!checkWizardOwner(interaction, userId)) {
    await replyError(interaction, 'Du hast diesen Wizard nicht geöffnet.');
    return;
  }

  const channel = interaction.channels.first();
  if (!channel) { await replyError(interaction, 'Kein Channel ausgewählt.'); return; }

  setWizardState(guildId, userId, { step: 3, live_channel_id: channel.id });
  await interaction.update(buildWizardStep3(guildId, userId));
}

// ── Buttons: Twitch/YouTube Modal öffnen, Skip, Ping, Finish ─────────────────

export async function handleWizardButton(
  interaction: ButtonInteraction,
  payload: string,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  const { action, guildId, userId } = parseWizardButtonIds(payload);
  if (!checkWizardOwner(interaction, userId)) {
    await replyError(interaction, 'Du hast diesen Wizard nicht geöffnet.');
    return;
  }

  const state = getWizardState(guildId, userId);

  if (action === 'twitch_modal') {
    await interaction.showModal(buildTwitchModal(guildId, userId, true));
    return;
  }

  if (action === 'youtube_modal') {
    await interaction.showModal(buildYouTubeModal(guildId, userId, true));
    return;
  }

  if (action === 'youtube_skip') {
    setWizardState(guildId, userId, { step: 5, youtube_api_key: null });
    await interaction.update(buildWizardStep5(guildId, userId));
    return;
  }

  if (action === 'interval_modal') {
    const current = state?.check_interval_seconds ?? 120;
    await interaction.showModal(buildIntervalModal(guildId, userId, current, true));
    return;
  }

  if (action.startsWith('ping:')) {
    const pingType = action.split(':')[1] as PingType;
    setWizardState(guildId, userId, { step: 7, announcement_ping_type: pingType });
    const updated = getWizardState(guildId, userId)!;
    await interaction.update(buildWizardStep7(guildId, userId, updated, interaction.guild!.name));
    return;
  }

  if (action.startsWith('finish:')) {
    const enabled = action.endsWith('enabled');
    await finishWizard(interaction, guildId, userId, enabled);
    return;
  }
}

async function finishWizard(
  interaction: ButtonInteraction,
  guildId: string,
  userId: string,
  enabled: boolean,
): Promise<void> {
  const state = getWizardState(guildId, userId);
  if (!state?.streamer_role_id || !state.live_channel_id || !state.twitch_client_id) {
    return replyError(interaction, 'Setup unvollständig. Bitte alle Pflichtfelder ausfüllen.');
  }

  upsertStreamerConfig(guildId, {
    enabled:                enabled ? 1 : 0,
    setup_completed:        1,
    streamer_role_id:       state.streamer_role_id,
    live_channel_id:        state.live_channel_id,
    check_interval_seconds: state.check_interval_seconds ?? 120,
    twitch_client_id:       state.twitch_client_id,
    twitch_client_secret:   state.twitch_client_secret,
    youtube_api_key:        state.youtube_api_key ?? null,
    announcement_ping_type: state.announcement_ping_type ?? 'none',
  });

  clearWizardState(guildId, userId);

  const config = getStreamerConfig(guildId)!;
  const counts = countStreamers(guildId);
  await interaction.update({
    embeds:     [buildDashboardEmbed(config, counts, interaction.guild!.name)],
    components: buildDashboardComponents(config, guildId, userId),
  });
}

// ── Modal Submissions ──────────────────────────────────────────────────────────

export async function handleWizardModal(
  interaction: ModalSubmitInteraction,
  payload: string,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  // payload format after parseId: "modal:twitch_wizard:guildId:userId" etc.
  const parts = payload.split(':');
  const modalType = parts[1]; // "twitch_wizard" | "youtube_wizard" | "interval_wizard"
  const guildId   = parts[2];
  const userId    = parts[3];

  if (!checkWizardOwner(interaction, userId)) {
    return replyError(interaction, 'Du hast diesen Wizard nicht geöffnet.');
  }

  if (modalType === 'twitch_wizard') {
    const clientId     = interaction.fields.getTextInputValue('client_id').trim();
    const clientSecret = interaction.fields.getTextInputValue('client_secret').trim();
    setWizardState(guildId, userId, { step: 4, twitch_client_id: clientId, twitch_client_secret: clientSecret });
    await interaction.reply({ ...buildWizardStep4(guildId, userId), ephemeral: true });
    return;
  }

  if (modalType === 'youtube_wizard') {
    const apiKey = interaction.fields.getTextInputValue('api_key').trim();
    setWizardState(guildId, userId, { step: 5, youtube_api_key: apiKey });
    await interaction.reply({ ...buildWizardStep5(guildId, userId), ephemeral: true });
    return;
  }

  if (modalType === 'interval_wizard') {
    const raw  = interaction.fields.getTextInputValue('interval_secs').trim();
    const secs = parseInt(raw, 10);
    if (isNaN(secs) || secs < 60) {
      await replyError(interaction, 'Ungültiger Wert. Minimum: 60 Sekunden.');
      return;
    }
    setWizardState(guildId, userId, { step: 6, check_interval_seconds: secs });
    await interaction.reply({ ...buildWizardStep6(guildId, userId), ephemeral: true });
    return;
  }
}

// ── Hilfsfunktionen für Payload-Parsing ───────────────────────────────────────

function parseWizardIds(payload: string): { guildId: string; userId: string } {
  // payload after parseId('str:...'): "wizard:role:GUILDID:USERID"
  // Last two parts are always guildId and userId
  const parts = payload.split(':');
  return { guildId: parts[parts.length - 2], userId: parts[parts.length - 1] };
}

function parseWizardButtonIds(payload: string): { action: string; guildId: string; userId: string } {
  // payload: "wizard:ACTION:GUILDID:USERID" or "wizard:ACTION:SUBACTION:GUILDID:USERID"
  const parts = payload.split(':');
  const guildId = parts[parts.length - 2];
  const userId  = parts[parts.length - 1];
  // action is everything between "wizard:" and the guildId/userId
  const actionParts = parts.slice(1, parts.length - 2);
  return { action: actionParts.join(':'), guildId, userId };
}

// Suppress unused import warning — clearTwitchTokenCache is available for
// use by handlers that update Twitch credentials post-wizard.
void (clearTwitchTokenCache as unknown);
