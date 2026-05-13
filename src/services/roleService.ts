import type { GuildMember } from 'discord.js';
import { getConfig } from './guildConfigService';
import { logger } from '../utils/logger';
import { BotError } from '../utils/errors';

export async function assignWhitelistRole(member: GuildMember): Promise<'assigned' | 'already_has'> {
  const roleId = getConfig(member.guild.id)?.whitelist_role_id;
  if (!roleId) {
    throw new BotError('Die Whitelist-Rolle ist nicht konfiguriert. Bitte wende dich an einen Admin (/setup).');
  }
  if (member.roles.cache.has(roleId)) {
    return 'already_has';
  }
  await member.roles.add(roleId, 'Regelwerk akzeptiert');
  logger.info(`Whitelist-Rolle vergeben: ${member.user.tag}`);
  return 'assigned';
}
