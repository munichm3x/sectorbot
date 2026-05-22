import {
  createTicketNote, getTicketNotes, deleteTicketNote as dbDeleteNote,
  type TicketNoteRow,
} from '../db/index';

export interface TicketNote {
  id:        number;
  ticketId:  number;
  guildId:   string;
  authorId:  string;
  authorTag: string;
  content:   string;
  createdAt: Date;
}

function toNote(row: TicketNoteRow): TicketNote {
  return {
    id:        row.id,
    ticketId:  row.ticket_id,
    guildId:   row.guild_id,
    authorId:  row.author_id,
    authorTag: row.author_tag,
    content:   row.content,
    createdAt: new Date(row.created_at * 1000),
  };
}

export async function addNote(
  ticketId:  number,
  guildId:   string,
  authorId:  string,
  authorTag: string,
  content:   string,
): Promise<TicketNote> {
  const row = createTicketNote({
    ticket_id:  ticketId,
    guild_id:   guildId,
    author_id:  authorId,
    author_tag: authorTag,
    content,
    created_at: Math.floor(Date.now() / 1000),
  });
  return toNote(row);
}

export async function getNotes(ticketId: number, guildId: string): Promise<TicketNote[]> {
  return getTicketNotes(ticketId, guildId).map(toNote);
}

export async function deleteNote(noteId: number, guildId: string): Promise<void> {
  dbDeleteNote(noteId, guildId);
}
