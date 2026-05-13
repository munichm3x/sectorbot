import type { GuildMember } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';
import { getSupportRoles } from './guildConfigService';
import type { Ticket } from '../types';

export function isAdmin(member: GuildMember): boolean {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

export function isSupport(member: GuildMember, guildId: string): boolean {
  return getSupportRoles(guildId).some(id => member.roles.cache.has(id));
}

export function isTicketOwner(member: GuildMember, ticket: Ticket): boolean {
  return member.id === ticket.opener_user_id;
}

export function canModerateTicket(member: GuildMember, ticket: Ticket, guildId: string): boolean {
  return isAdmin(member) || isSupport(member, guildId) || isTicketOwner(member, ticket);
}
