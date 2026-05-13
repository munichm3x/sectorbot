import type { Guild } from 'discord.js';
import { getConfig } from './guildConfigService';
import { createLogEmbed } from './embedService';
import { logger } from '../utils/logger';

export async function logEvent(
  guild: Guild,
  event: string,
  fields: { name: string; value: string; inline?: boolean }[]
): Promise<void> {
  try {
    const logChannelId = getConfig(guild.id)?.ticket_log_channel_id;
    if (!logChannelId) return;
    const channel = await guild.channels.fetch(logChannelId);
    if (!channel?.isTextBased()) return;
    await channel.send({ embeds: [createLogEmbed(event, fields)] });
  } catch (err) {
    logger.error('Log-Event konnte nicht gesendet werden', err);
  }
}
