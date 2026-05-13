import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PermissionFlagsBits } from 'discord.js';
import { isAdmin, isSupport, isTicketOwner, canModerateTicket } from './permissionService';
import type { GuildMember } from 'discord.js';
import type { Ticket } from '../types';

vi.mock('./guildConfigService', () => ({
  getSupportRoles: (guildId: string) => guildId === 'g1' ? ['support-role'] : [],
}));

function makeMember(opts: { permissions?: bigint; roles?: string[]; id?: string }): GuildMember {
  const perms = opts.permissions ?? 0n;
  const roles = opts.roles ?? [];
  return {
    id: opts.id ?? 'user1',
    permissions: { has: (flag: bigint) => (perms & flag) === flag },
    roles: { cache: { has: (id: string) => roles.includes(id) } },
  } as unknown as GuildMember;
}

const ticket: Ticket = {
  id: 1, guild_id: 'g1', channel_id: 'c', opener_user_id: 'owner1',
  category: 'allgemein', status: 'open', claimed_by: null,
  created_at: 1, closed_at: null,
};

describe('isAdmin', () => {
  it('true for Administrator permission', () =>
    expect(isAdmin(makeMember({ permissions: PermissionFlagsBits.Administrator }))).toBe(true));
  it('true for ManageGuild permission', () =>
    expect(isAdmin(makeMember({ permissions: PermissionFlagsBits.ManageGuild }))).toBe(true));
  it('false for no permissions', () =>
    expect(isAdmin(makeMember({}))).toBe(false));
  it('false for unrelated role (no longer checks role IDs)', () =>
    expect(isAdmin(makeMember({ roles: ['some-role'] }))).toBe(false));
});

describe('isSupport', () => {
  it('true when guild has the role and member has it', () =>
    expect(isSupport(makeMember({ roles: ['support-role'] }), 'g1')).toBe(true));
  it('false when member lacks the role', () =>
    expect(isSupport(makeMember({ roles: [] }), 'g1')).toBe(false));
  it('false when guild has no support roles configured', () =>
    expect(isSupport(makeMember({ roles: ['support-role'] }), 'other-guild')).toBe(false));
});

describe('isTicketOwner', () => {
  it('true when member is opener', () =>
    expect(isTicketOwner(makeMember({ id: 'owner1' }), ticket)).toBe(true));
  it('false for other users', () =>
    expect(isTicketOwner(makeMember({ id: 'other' }), ticket)).toBe(false));
});

describe('canModerateTicket', () => {
  it('allows admin (Administrator perm)', () =>
    expect(canModerateTicket(makeMember({ permissions: PermissionFlagsBits.Administrator }), ticket, 'g1')).toBe(true));
  it('allows admin (ManageGuild perm)', () =>
    expect(canModerateTicket(makeMember({ permissions: PermissionFlagsBits.ManageGuild }), ticket, 'g1')).toBe(true));
  it('allows support role from DB', () =>
    expect(canModerateTicket(makeMember({ roles: ['support-role'] }), ticket, 'g1')).toBe(true));
  it('allows ticket owner', () =>
    expect(canModerateTicket(makeMember({ id: 'owner1' }), ticket, 'g1')).toBe(true));
  it('denies others', () =>
    expect(canModerateTicket(makeMember({ id: 'stranger' }), ticket, 'g1')).toBe(false));
});
