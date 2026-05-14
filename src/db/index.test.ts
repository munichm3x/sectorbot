import { describe, it, expect, beforeEach } from 'vitest';
import {
  initDb, createTicket, findOpenTicketByUser,
  findTicketByChannel, closeTicket, claimTicket,
  upsertPanel, getPanel,
  getOldManChannel, setOldManChannel, disableOldManChannel,
} from './index';

beforeEach(() => {
  initDb(':memory:');
});

describe('tickets', () => {
  it('creates a ticket and returns it with status open', () => {
    const ticket = createTicket({
      guild_id: 'g1', channel_id: 'c1',
      opener_user_id: 'u1', category: 'allgemein', created_at: 1000,
    });
    expect(ticket.status).toBe('open');
    expect(ticket.id).toBeGreaterThan(0);
  });

  it('findOpenTicketByUser returns the open ticket', () => {
    createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'allgemein', created_at: 1 });
    const found = findOpenTicketByUser('g1', 'u1');
    expect(found?.channel_id).toBe('c1');
  });

  it('findOpenTicketByUser returns undefined when no open ticket', () => {
    expect(findOpenTicketByUser('g1', 'u1')).toBeUndefined();
  });

  it('findOpenTicketByUser returns undefined after ticket is closed', () => {
    createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'allgemein', created_at: 1 });
    closeTicket('c1');
    expect(findOpenTicketByUser('g1', 'u1')).toBeUndefined();
  });

  it('findTicketByChannel returns ticket regardless of status', () => {
    createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'allgemein', created_at: 1 });
    closeTicket('c1');
    expect(findTicketByChannel('c1')?.status).toBe('closed');
  });

  it('claimTicket sets claimed_by', () => {
    createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'allgemein', created_at: 1 });
    claimTicket('c1', 'supporter1');
    expect(findTicketByChannel('c1')?.claimed_by).toBe('supporter1');
  });

  it('prevents duplicate channel_id', () => {
    createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1', category: 'allgemein', created_at: 1 });
    expect(() =>
      createTicket({ guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u2', category: 'allgemein', created_at: 2 })
    ).toThrow();
  });
});

describe('panels', () => {
  it('upserts and retrieves a panel', () => {
    upsertPanel('g1', 'tickets', 'chan1', 'msg1');
    expect(getPanel('g1', 'tickets')?.message_id).toBe('msg1');
  });

  it('updates existing panel on second upsert', () => {
    upsertPanel('g1', 'tickets', 'chan1', 'msg1');
    upsertPanel('g1', 'tickets', 'chan1', 'msg2');
    expect(getPanel('g1', 'tickets')?.message_id).toBe('msg2');
  });

  it('getPanel returns undefined for unknown guild', () => {
    expect(getPanel('unknown', 'tickets')).toBeUndefined();
  });
});

describe('oldman_config', () => {
  it('setOldManChannel stores a channel and getOldManChannel retrieves it', () => {
    setOldManChannel('g1', 'ch1');
    expect(getOldManChannel('g1')).toBe('ch1');
  });

  it('setOldManChannel overwrites an existing entry', () => {
    setOldManChannel('g1', 'ch1');
    setOldManChannel('g1', 'ch2');
    expect(getOldManChannel('g1')).toBe('ch2');
  });

  it('getOldManChannel returns undefined when not configured', () => {
    expect(getOldManChannel('unknown-guild')).toBeUndefined();
  });

  it('disableOldManChannel removes the entry', () => {
    setOldManChannel('g1', 'ch1');
    disableOldManChannel('g1');
    expect(getOldManChannel('g1')).toBeUndefined();
  });

  it('disableOldManChannel does not throw when entry does not exist', () => {
    expect(() => disableOldManChannel('nonexistent')).not.toThrow();
  });
});
