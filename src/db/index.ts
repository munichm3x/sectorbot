import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import {
  CREATE_TICKETS_TABLE, CREATE_PANELS_TABLE,
  CREATE_GUILD_CONFIG_TABLE, CREATE_GUILD_SUPPORT_ROLES_TABLE, CREATE_TICKET_CATEGORY_CONFIG_TABLE,
} from './schema';
import type { Ticket, Panel, GuildConfig, TicketCategoryConfig } from '../types';
import { logger } from '../utils/logger';

let db: Database.Database;

export function initDb(path: string): void {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.exec(CREATE_TICKETS_TABLE);
  db.exec(CREATE_PANELS_TABLE);
  db.exec(CREATE_GUILD_CONFIG_TABLE);
  db.exec(CREATE_GUILD_SUPPORT_ROLES_TABLE);
  db.exec(CREATE_TICKET_CATEGORY_CONFIG_TABLE);
  if (path !== ':memory:') logger.info(`Datenbank initialisiert: ${path}`);
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Datenbank nicht initialisiert. initDb() aufrufen.');
  return db;
}

export function createTicket(
  data: Omit<Ticket, 'id' | 'status' | 'claimed_by' | 'closed_at'>
): Ticket {
  const stmt = getDb().prepare(`
    INSERT INTO tickets (guild_id, channel_id, opener_user_id, category, status, created_at)
    VALUES (@guild_id, @channel_id, @opener_user_id, @category, 'open', @created_at)
  `);
  const result = stmt.run(data);
  return getTicketById(result.lastInsertRowid as number)!;
}

export function findOpenTicketByUser(guildId: string, userId: string): Ticket | undefined {
  return getDb()
    .prepare(`SELECT * FROM tickets WHERE guild_id = ? AND opener_user_id = ? AND status = 'open'`)
    .get(guildId, userId) as Ticket | undefined;
}

export function findTicketByChannel(channelId: string): Ticket | undefined {
  return getDb()
    .prepare(`SELECT * FROM tickets WHERE channel_id = ?`)
    .get(channelId) as Ticket | undefined;
}

export function closeTicket(channelId: string): void {
  getDb()
    .prepare(`UPDATE tickets SET status = 'closed', closed_at = ? WHERE channel_id = ?`)
    .run(Math.floor(Date.now() / 1000), channelId);
}

export function claimTicket(channelId: string, userId: string): void {
  getDb()
    .prepare(`UPDATE tickets SET claimed_by = ? WHERE channel_id = ?`)
    .run(userId, channelId);
}

export function upsertPanel(
  guildId: string,
  type: 'tickets' | 'rules',
  channelId: string,
  messageId: string
): void {
  getDb().prepare(`
    INSERT INTO panels (guild_id, type, channel_id, message_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id, type) DO UPDATE SET channel_id = excluded.channel_id, message_id = excluded.message_id
  `).run(guildId, type, channelId, messageId);
}

export function getPanel(guildId: string, type: 'tickets' | 'rules'): Panel | undefined {
  return getDb()
    .prepare(`SELECT * FROM panels WHERE guild_id = ? AND type = ?`)
    .get(guildId, type) as Panel | undefined;
}

export function getGuildConfig(guildId: string): GuildConfig | undefined {
  return getDb()
    .prepare('SELECT * FROM guild_config WHERE guild_id = ?')
    .get(guildId) as GuildConfig | undefined;
}

export function upsertGuildConfig(
  guildId: string,
  data: Partial<Omit<GuildConfig, 'guild_id' | 'created_at' | 'updated_at'>>
): GuildConfig {
  const now = Math.floor(Date.now() / 1000);
  getDb().prepare(`
    INSERT INTO guild_config (
      guild_id, ticket_panel_channel_id, ticket_category_id,
      ticket_log_channel_id, rules_channel_id, whitelist_role_id,
      ticket_panel_message_id, rules_message_id, setup_completed,
      created_at, updated_at
    ) VALUES (
      @guild_id, @ticket_panel_channel_id, @ticket_category_id,
      @ticket_log_channel_id, @rules_channel_id, @whitelist_role_id,
      @ticket_panel_message_id, @rules_message_id, @setup_completed,
      @now, @now
    ) ON CONFLICT(guild_id) DO UPDATE SET
      ticket_panel_channel_id = COALESCE(@ticket_panel_channel_id, ticket_panel_channel_id),
      ticket_category_id      = COALESCE(@ticket_category_id, ticket_category_id),
      ticket_log_channel_id   = COALESCE(@ticket_log_channel_id, ticket_log_channel_id),
      rules_channel_id        = COALESCE(@rules_channel_id, rules_channel_id),
      whitelist_role_id       = COALESCE(@whitelist_role_id, whitelist_role_id),
      ticket_panel_message_id = COALESCE(@ticket_panel_message_id, ticket_panel_message_id),
      rules_message_id        = COALESCE(@rules_message_id, rules_message_id),
      setup_completed         = COALESCE(@setup_completed, setup_completed),
      updated_at              = @now
  `).run({
    guild_id:                guildId,
    ticket_panel_channel_id: data.ticket_panel_channel_id ?? null,
    ticket_category_id:      data.ticket_category_id ?? null,
    ticket_log_channel_id:   data.ticket_log_channel_id ?? null,
    rules_channel_id:        data.rules_channel_id ?? null,
    whitelist_role_id:       data.whitelist_role_id ?? null,
    ticket_panel_message_id: data.ticket_panel_message_id ?? null,
    rules_message_id:        data.rules_message_id ?? null,
    setup_completed:         data.setup_completed ?? 0,
    now,
  });
  return getGuildConfig(guildId)!;
}

export function getGuildSupportRoles(guildId: string): string[] {
  const rows = getDb()
    .prepare('SELECT role_id FROM guild_support_roles WHERE guild_id = ?')
    .all(guildId) as { role_id: string }[];
  return rows.map(r => r.role_id);
}

export function setGuildSupportRoles(guildId: string, roleIds: string[]): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare('DELETE FROM guild_support_roles WHERE guild_id = ?').run(guildId);
    const stmt = db.prepare('INSERT OR IGNORE INTO guild_support_roles (guild_id, role_id) VALUES (?, ?)');
    for (const roleId of roleIds) stmt.run(guildId, roleId);
  })();
}

export function getTicketCategoryConfigs(guildId: string): TicketCategoryConfig[] {
  return getDb()
    .prepare('SELECT * FROM ticket_category_config WHERE guild_id = ? AND enabled = 1 ORDER BY sort_order')
    .all(guildId) as TicketCategoryConfig[];
}

export function getAllTicketCategoryConfigs(guildId: string): TicketCategoryConfig[] {
  return getDb()
    .prepare('SELECT * FROM ticket_category_config WHERE guild_id = ? ORDER BY sort_order')
    .all(guildId) as TicketCategoryConfig[];
}

export function upsertTicketCategoryConfig(data: Omit<TicketCategoryConfig, 'id'>): void {
  getDb().prepare(`
    INSERT INTO ticket_category_config (guild_id, key, label, description, emoji, sort_order, enabled)
    VALUES (@guild_id, @key, @label, @description, @emoji, @sort_order, @enabled)
    ON CONFLICT(guild_id, key) DO UPDATE SET
      label       = @label,
      description = @description,
      emoji       = @emoji,
      sort_order  = @sort_order,
      enabled     = @enabled
  `).run(data);
}

export function deleteTicketCategoryConfig(guildId: string, key: string): void {
  getDb()
    .prepare('DELETE FROM ticket_category_config WHERE guild_id = ? AND key = ?')
    .run(guildId, key);
}

function getTicketById(id: number): Ticket | undefined {
  return getDb()
    .prepare(`SELECT * FROM tickets WHERE id = ?`)
    .get(id) as Ticket | undefined;
}
