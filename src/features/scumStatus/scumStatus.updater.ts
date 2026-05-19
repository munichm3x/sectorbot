import type { Client } from 'discord.js';
import {
  getScumStatusConfig, getAllActiveScumStatuses,
  setScumStatusMessageId, setScumStatusEnabled,
} from '../../db/index';
import { queryServer } from './scumStatus.service';
import { buildStatusEmbed } from './scumStatus.embed';
import { logger } from '../../utils/logger';

const MIN_INTERVAL_SECS = 30;

let _client: Client;
const activeIntervals = new Map<string, ReturnType<typeof setInterval>>();

export function setupScumStatus(client: Client): void {
  _client = client;
  client.once('ready', async (c) => {
    _client = c;
    const configs = getAllActiveScumStatuses();
    for (const config of configs) {
      startInterval(config.guild_id);
    }
    logger.info(`[scumStatus] ${configs.length} Update-Loop(s) gestartet.`);
  });
}

export function startInterval(guildId: string): void {
  stopInterval(guildId);

  const config = getScumStatusConfig(guildId);
  if (!config?.enabled || !config.channel_id || !config.host) return;

  const secs = Math.max(config.update_interval_secs, MIN_INTERVAL_SECS);
  const ms   = secs * 1000;

  void updateDashboard(guildId);
  activeIntervals.set(guildId, setInterval(() => { void updateDashboard(guildId); }, ms));
}

export function stopInterval(guildId: string): void {
  const existing = activeIntervals.get(guildId);
  if (existing) {
    clearInterval(existing);
    activeIntervals.delete(guildId);
  }
}

async function updateDashboard(guildId: string): Promise<void> {
  const config = getScumStatusConfig(guildId);
  if (!config?.enabled || !config.channel_id || !config.host || !config.query_port) {
    stopInterval(guildId);
    return;
  }

  try {
    const guild   = await _client.guilds.fetch(guildId).catch(() => null);
    const channel = guild
      ? await guild.channels.fetch(config.channel_id).catch(() => null)
      : null;

    if (!channel?.isTextBased()) {
      logger.warn(`[scumStatus] Channel nicht gefunden — Guild ${guildId}. Dashboard deaktiviert.`);
      setScumStatusEnabled(guildId, false);
      stopInterval(guildId);
      return;
    }

    const result = await queryServer(config.host, config.query_port);
    const embed  = buildStatusEmbed(result, config.host, config.query_port);

    let msgId = config.message_id ?? null;

    if (msgId) {
      try {
        const msg = await channel.messages.fetch(msgId);
        await msg.edit({ embeds: [embed] });
        return;
      } catch {
        msgId = null;
      }
    }

    const msg = await channel.send({ embeds: [embed] });
    setScumStatusMessageId(guildId, msg.id);
  } catch (err) {
    logger.error(`[scumStatus] Update-Fehler — Guild ${guildId}: ${err}`);
  }
}
