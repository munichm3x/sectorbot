import { describe, it, expect, beforeEach } from 'vitest';
import { initDb, getDb, createTicket } from '../index';

describe('ticket migration', () => {
  beforeEach(() => { initDb(':memory:'); });

  it('new ticket columns exist after initDb', () => {
    const info = getDb().prepare(`PRAGMA table_info(tickets)`).all() as { name: string }[];
    const cols = info.map(c => c.name);
    expect(cols).toContain('priority');
    expect(cols).toContain('close_reason');
    expect(cols).toContain('tags');
    expect(cols).toContain('transcript_path');
    expect(cols).toContain('archived_at');
    expect(cols).toContain('welcome_message_id');
  });

  it('ticket_notes table and index exist', () => {
    const table = getDb()
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='ticket_notes'`)
      .get();
    expect(table).toBeTruthy();
    const idx = getDb()
      .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name='idx_ticket_notes_ticket_id'`)
      .get();
    expect(idx).toBeTruthy();
  });

  it('priority defaults to medium for new tickets', () => {
    const ticket = createTicket({
      guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1',
      category: 'general', created_at: 1000,
    });
    const row = getDb()
      .prepare(`SELECT priority FROM tickets WHERE id = ?`)
      .get(ticket.id) as { priority: string };
    expect(row.priority).toBe('medium');
  });

  it('ALTER TABLE is idempotent — second initDb does not throw', () => {
    expect(() => initDb(':memory:')).not.toThrow();
  });

  it('existing ticket data survives migration', () => {
    const ticket = createTicket({
      guild_id: 'g1', channel_id: 'c2', opener_user_id: 'u1',
      category: 'ban', created_at: 5000,
    });
    const row = getDb()
      .prepare(`SELECT * FROM tickets WHERE id = ?`)
      .get(ticket.id) as { id: number; category: string; priority: string };
    expect(row.id).toBe(ticket.id);
    expect(row.category).toBe('ban');
    expect(row.priority).toBe('medium');
  });
});
