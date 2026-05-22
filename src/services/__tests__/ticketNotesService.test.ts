import { describe, it, expect, beforeEach } from 'vitest';
import { initDb, createTicket } from '../../db/index';
import { addNote, getNotes, deleteNote } from '../ticketNotesService';

let ticketId: number;

beforeEach(() => {
  initDb(':memory:');
  const t = createTicket({
    guild_id: 'g1', channel_id: 'c1', opener_user_id: 'u1',
    category: 'ban', created_at: 1000,
  });
  ticketId = t.id;
});

describe('addNote', () => {
  it('creates and returns a note with correct fields', async () => {
    const note = await addNote(ticketId, 'g1', 'a1', 'Admin#0001', 'Testnotiz');
    expect(note.id).toBeGreaterThan(0);
    expect(note.ticketId).toBe(ticketId);
    expect(note.guildId).toBe('g1');
    expect(note.authorId).toBe('a1');
    expect(note.authorTag).toBe('Admin#0001');
    expect(note.content).toBe('Testnotiz');
    expect(note.createdAt).toBeInstanceOf(Date);
  });
});

describe('getNotes', () => {
  it('returns notes in chronological order', async () => {
    await addNote(ticketId, 'g1', 'a1', 'Admin#0001', 'Erste Notiz');
    await addNote(ticketId, 'g1', 'a2', 'Mod#0002', 'Zweite Notiz');
    const notes = await getNotes(ticketId, 'g1');
    expect(notes).toHaveLength(2);
    expect(notes[0]!.content).toBe('Erste Notiz');
    expect(notes[1]!.content).toBe('Zweite Notiz');
  });

  it('returns empty array when no notes exist', async () => {
    const notes = await getNotes(ticketId, 'g1');
    expect(notes).toHaveLength(0);
  });

  it('guild isolation — other guild sees no notes', async () => {
    await addNote(ticketId, 'g1', 'a1', 'Admin#0001', 'Nur für g1');
    const notes = await getNotes(ticketId, 'g2');
    expect(notes).toHaveLength(0);
  });
});

describe('deleteNote', () => {
  it('removes the note', async () => {
    const note = await addNote(ticketId, 'g1', 'a1', 'Admin#0001', 'Zu löschen');
    await deleteNote(note.id, 'g1');
    const notes = await getNotes(ticketId, 'g1');
    expect(notes).toHaveLength(0);
  });

  it('is no-op for wrong guild', async () => {
    const note = await addNote(ticketId, 'g1', 'a1', 'Admin#0001', 'Bleibt');
    await deleteNote(note.id, 'g2');
    const notes = await getNotes(ticketId, 'g1');
    expect(notes).toHaveLength(1);
  });
});
