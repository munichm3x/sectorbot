import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import {
  CREATE_TICKETS_TABLE, CREATE_PANELS_TABLE,
  CREATE_GUILD_CONFIG_TABLE, CREATE_GUILD_SUPPORT_ROLES_TABLE,
  CREATE_TICKET_CATEGORY_CONFIG_TABLE, CREATE_OLDMAN_CONFIG_TABLE,
  CREATE_CHANGELOG_CONFIG_TABLE, CREATE_SCUM_STATUS_CONFIG_TABLE,
  CREATE_STREAMER_CONFIG_TABLE,
  CREATE_STREAMERS_TABLE,
  CREATE_STREAM_LIVE_STATES_TABLE,
} from './schema';
import {
  CREATE_SERVER_STATUS_HISTORY,
  CREATE_DISCORD_MESSAGE_ACTIVITY,
  CREATE_VOICE_SESSION_TEMP,
  CREATE_DISCORD_VOICE_ACTIVITY,
  CREATE_BOT_INTERACTION_EVENTS,
  CREATE_AI_USAGE_EVENTS,
  CREATE_MEMBER_EVENTS,
  CREATE_DASHBOARD_AUDIT_LOGS,
} from '../analytics/analytics.schema';
import type { Ticket, Panel, GuildConfig, TicketCategoryConfig, ChangelogConfig, ScumStatusConfig } from '../types';
import { logger } from '../utils/logger';

let db: Database.Database;

export function initDb(path: string): void {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.exec(CREATE_TICKETS_TABLE);
  // Migrations — safe to run on every start (ALTER TABLE is ignored if column exists)
  try { db.exec(`ALTER TABLE tickets ADD COLUMN last_activity_at INTEGER`);  } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE tickets ADD COLUMN closed_by TEXT`);                        } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE tickets ADD COLUMN message_count INTEGER`);               } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE tickets ADD COLUMN summary TEXT`);                         } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE tickets ADD COLUMN archive_message_id TEXT`);             } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE tickets ADD COLUMN archive_channel_id TEXT`);             } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE tickets ADD COLUMN username_snapshot TEXT`);              } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE tickets ADD COLUMN closed_by_username_snapshot TEXT`);    } catch { /* already exists */ }
  db.exec(CREATE_PANELS_TABLE);
  db.exec(CREATE_GUILD_CONFIG_TABLE);
  try { db.exec(`ALTER TABLE guild_config ADD COLUMN ticket_archive_channel_id TEXT`); } catch { /* already exists */ }
  db.exec(CREATE_GUILD_SUPPORT_ROLES_TABLE);
  db.exec(CREATE_TICKET_CATEGORY_CONFIG_TABLE);
  db.exec(CREATE_OLDMAN_CONFIG_TABLE);
  db.exec(CREATE_CHANGELOG_CONFIG_TABLE);
  db.exec(CREATE_SCUM_STATUS_CONFIG_TABLE);
  db.exec(CREATE_STREAMER_CONFIG_TABLE);
  db.exec(CREATE_STREAMERS_TABLE);
  db.exec(CREATE_STREAM_LIVE_STATES_TABLE);
  db.exec(`CREATE TABLE IF NOT EXISTS msg_dedup (id TEXT PRIMARY KEY, ts INTEGER NOT NULL)`);
  initAnalyticsDb();
  if (path !== ':memory:') logger.info(`Datenbank initialisiert: ${path}`);
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Datenbank nicht initialisiert. initDb() aufrufen.');
  return db;
}

export function initAnalyticsDb(): void {
  const database = getDb();
  database.exec(CREATE_SERVER_STATUS_HISTORY);
  database.exec(CREATE_DISCORD_MESSAGE_ACTIVITY);
  database.exec(CREATE_VOICE_SESSION_TEMP);
  database.exec(CREATE_DISCORD_VOICE_ACTIVITY);
  database.exec(CREATE_BOT_INTERACTION_EVENTS);
  database.exec(CREATE_AI_USAGE_EVENTS);
  database.exec(CREATE_MEMBER_EVENTS);
  database.exec(CREATE_DASHBOARD_AUDIT_LOGS);
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

export function getAllOpenTickets(): Ticket[] {
  return getDb()
    .prepare(`SELECT * FROM tickets WHERE status = 'open'`)
    .all() as Ticket[];
}

export function touchTicketActivity(channelId: string): void {
  getDb()
    .prepare(`UPDATE tickets SET last_activity_at = ? WHERE channel_id = ? AND status = 'open'`)
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
      ticket_log_channel_id, ticket_archive_channel_id, rules_channel_id, whitelist_role_id,
      ticket_panel_message_id, rules_message_id, setup_completed,
      created_at, updated_at
    ) VALUES (
      @guild_id, @ticket_panel_channel_id, @ticket_category_id,
      @ticket_log_channel_id, @ticket_archive_channel_id, @rules_channel_id, @whitelist_role_id,
      @ticket_panel_message_id, @rules_message_id, @setup_completed,
      @now, @now
    ) ON CONFLICT(guild_id) DO UPDATE SET
      ticket_panel_channel_id   = COALESCE(@ticket_panel_channel_id,   ticket_panel_channel_id),
      ticket_category_id        = COALESCE(@ticket_category_id,        ticket_category_id),
      ticket_log_channel_id     = COALESCE(@ticket_log_channel_id,     ticket_log_channel_id),
      ticket_archive_channel_id = COALESCE(@ticket_archive_channel_id, ticket_archive_channel_id),
      rules_channel_id          = COALESCE(@rules_channel_id,          rules_channel_id),
      whitelist_role_id         = COALESCE(@whitelist_role_id,         whitelist_role_id),
      ticket_panel_message_id   = COALESCE(@ticket_panel_message_id,   ticket_panel_message_id),
      rules_message_id          = COALESCE(@rules_message_id,          rules_message_id),
      setup_completed           = COALESCE(@setup_completed,           setup_completed),
      updated_at                = @now
  `).run({
    guild_id:                  guildId,
    ticket_panel_channel_id:   data.ticket_panel_channel_id   ?? null,
    ticket_category_id:        data.ticket_category_id        ?? null,
    ticket_log_channel_id:     data.ticket_log_channel_id     ?? null,
    ticket_archive_channel_id: data.ticket_archive_channel_id ?? null,
    rules_channel_id:          data.rules_channel_id          ?? null,
    whitelist_role_id:         data.whitelist_role_id         ?? null,
    ticket_panel_message_id:   data.ticket_panel_message_id   ?? null,
    rules_message_id:          data.rules_message_id          ?? null,
    setup_completed:           data.setup_completed           ?? 0,
    now,
  });
  return getGuildConfig(guildId)!;
}

export function enrichTicketClose(
  channelId: string,
  closedBy: string,
  messageCount: number,
  summary: string,
): void {
  getDb()
    .prepare(`
      UPDATE tickets
      SET closed_by = ?, message_count = ?, summary = ?
      WHERE channel_id = ?
    `)
    .run(closedBy, messageCount, summary.slice(0, 2000), channelId);
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

export function getOldManChannel(guildId: string): string | undefined {
  const row = getDb()
    .prepare('SELECT channel_id FROM oldman_config WHERE guild_id = ?')
    .get(guildId) as { channel_id: string } | undefined;
  return row?.channel_id;
}

export function setOldManChannel(guildId: string, channelId: string): void {
  getDb().prepare(`
    INSERT INTO oldman_config (guild_id, channel_id)
    VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id
  `).run(guildId, channelId);
}

export function disableOldManChannel(guildId: string): void {
  getDb()
    .prepare('DELETE FROM oldman_config WHERE guild_id = ?')
    .run(guildId);
}

function getTicketById(id: number): Ticket | undefined {
  return getDb()
    .prepare(`SELECT * FROM tickets WHERE id = ?`)
    .get(id) as Ticket | undefined;
}

export function getChangelogConfig(guildId: string): ChangelogConfig | undefined {
  return getDb()
    .prepare('SELECT * FROM changelog_config WHERE guild_id = ?')
    .get(guildId) as ChangelogConfig | undefined;
}

export function upsertChangelogConfig(
  guildId: string,
  data: Partial<Omit<ChangelogConfig, 'guild_id'>>,
): ChangelogConfig {
  getDb().prepare(`
    INSERT INTO changelog_config (guild_id, create_channel_id, public_channel_id, dashboard_msg_id)
    VALUES (@guild_id, @create_channel_id, @public_channel_id, @dashboard_msg_id)
    ON CONFLICT(guild_id) DO UPDATE SET
      create_channel_id = COALESCE(@create_channel_id, create_channel_id),
      public_channel_id = COALESCE(@public_channel_id, public_channel_id),
      dashboard_msg_id  = COALESCE(@dashboard_msg_id,  dashboard_msg_id)
  `).run({
    guild_id:          guildId,
    create_channel_id: data.create_channel_id ?? null,
    public_channel_id: data.public_channel_id ?? null,
    dashboard_msg_id:  data.dashboard_msg_id  ?? null,
  });
  return getChangelogConfig(guildId)!;
}

export function getScumStatusConfig(guildId: string): ScumStatusConfig | undefined {
  return getDb()
    .prepare('SELECT * FROM scum_status_config WHERE guild_id = ?')
    .get(guildId) as ScumStatusConfig | undefined;
}

export function upsertScumStatusConfig(
  guildId: string,
  data: Partial<Omit<ScumStatusConfig, 'guild_id' | 'created_at' | 'updated_at'>>,
): ScumStatusConfig {
  getDb().prepare(`
    INSERT INTO scum_status_config (guild_id, enabled, channel_id, message_id, host, query_port, update_interval_secs)
    VALUES (@guild_id, COALESCE(@enabled, 0), @channel_id, @message_id, @host, @query_port, COALESCE(@update_interval_secs, 60))
    ON CONFLICT(guild_id) DO UPDATE SET
      enabled               = COALESCE(@enabled,               enabled),
      channel_id            = COALESCE(@channel_id,            channel_id),
      message_id            = COALESCE(@message_id,            message_id),
      host                  = COALESCE(@host,                  host),
      query_port            = COALESCE(@query_port,            query_port),
      update_interval_secs  = COALESCE(@update_interval_secs,  update_interval_secs),
      updated_at            = datetime('now')
  `).run({
    guild_id:             guildId,
    enabled:              data.enabled              ?? null,
    channel_id:           data.channel_id           ?? null,
    message_id:           data.message_id           ?? null,
    host:                 data.host                 ?? null,
    query_port:           data.query_port           ?? null,
    update_interval_secs: data.update_interval_secs ?? null,
  });
  return getScumStatusConfig(guildId)!;
}

export function setScumStatusMessageId(guildId: string, messageId: string | null): void {
  getDb()
    .prepare(`UPDATE scum_status_config SET message_id = ?, updated_at = datetime('now') WHERE guild_id = ?`)
    .run(messageId, guildId);
}

export function setScumStatusEnabled(guildId: string, enabled: boolean): void {
  getDb()
    .prepare(`UPDATE scum_status_config SET enabled = ?, updated_at = datetime('now') WHERE guild_id = ?`)
    .run(enabled ? 1 : 0, guildId);
}

export function getAllActiveScumStatuses(): ScumStatusConfig[] {
  return getDb()
    .prepare(`
      SELECT * FROM scum_status_config
      WHERE enabled = 1 AND host IS NOT NULL AND channel_id IS NOT NULL
    `)
    .all() as ScumStatusConfig[];
}

// ─── Ticket Archive Queries ───────────────────────────────────────────────────

export function setTicketArchiveInfo(
  channelId:        string,
  archiveMessageId: string,
  archiveChannelId: string,
  usernameSnapshot: string | null,
  closedBySnapshot: string | null,
): void {
  getDb()
    .prepare(`
      UPDATE tickets
      SET archive_message_id = ?, archive_channel_id = ?,
          username_snapshot = ?, closed_by_username_snapshot = ?
      WHERE channel_id = ?
    `)
    .run(archiveMessageId, archiveChannelId, usernameSnapshot, closedBySnapshot, channelId);
}

export function getRecentClosedTickets(
  guildId: string,
  limit:   number,
  offset:  number,
): Ticket[] {
  return getDb()
    .prepare(`
      SELECT * FROM tickets
      WHERE guild_id = ? AND status = 'closed'
      ORDER BY COALESCE(closed_at, created_at) DESC
      LIMIT ? OFFSET ?
    `)
    .all(guildId, limit, offset) as Ticket[];
}

export function countClosedTickets(guildId: string): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND status = 'closed'`)
    .get(guildId) as { n: number };
  return row.n;
}

export function searchClosedTickets(
  guildId: string,
  query:   string,
  limit:   number,
  offset:  number,
): Ticket[] {
  const like = `%${query}%`;
  return getDb()
    .prepare(`
      SELECT * FROM tickets
      WHERE guild_id = ? AND status = 'closed'
        AND (
          CAST(id AS TEXT)           LIKE ? OR
          opener_user_id             LIKE ? OR
          closed_by                  LIKE ? OR
          category                   LIKE ? OR
          summary                    LIKE ? OR
          username_snapshot          LIKE ? OR
          closed_by_username_snapshot LIKE ?
        )
      ORDER BY COALESCE(closed_at, created_at) DESC
      LIMIT ? OFFSET ?
    `)
    .all(guildId, like, like, like, like, like, like, like, limit, offset) as Ticket[];
}

export function countSearchClosedTickets(guildId: string, query: string): number {
  const like = `%${query}%`;
  const row = getDb()
    .prepare(`
      SELECT COUNT(*) AS n FROM tickets
      WHERE guild_id = ? AND status = 'closed'
        AND (
          CAST(id AS TEXT)           LIKE ? OR
          opener_user_id             LIKE ? OR
          closed_by                  LIKE ? OR
          category                   LIKE ? OR
          summary                    LIKE ? OR
          username_snapshot          LIKE ? OR
          closed_by_username_snapshot LIKE ?
        )
    `)
    .get(guildId, like, like, like, like, like, like, like) as { n: number };
  return row.n;
}

export function getClosedTicketById(id: number, guildId: string): Ticket | undefined {
  return getDb()
    .prepare(`SELECT * FROM tickets WHERE id = ? AND guild_id = ?`)
    .get(id, guildId) as Ticket | undefined;
}

export function getTicketStats(guildId: string): {
  total: number;
  thisWeek: number;
  thisMonth: number;
  topCategory: string | null;
  lastClosed: Ticket | undefined;
} {
  const now      = Math.floor(Date.now() / 1000);
  const weekAgo  = now - 7  * 86400;
  const monthAgo = now - 30 * 86400;
  const db       = getDb();

  const total     = (db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND status = 'closed'`).get(guildId) as { n: number }).n;
  const thisWeek  = (db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND status = 'closed' AND COALESCE(closed_at, created_at) >= ?`).get(guildId, weekAgo)  as { n: number }).n;
  const thisMonth = (db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE guild_id = ? AND status = 'closed' AND COALESCE(closed_at, created_at) >= ?`).get(guildId, monthAgo) as { n: number }).n;
  const topRow    = db.prepare(`SELECT category, COUNT(*) AS n FROM tickets WHERE guild_id = ? AND status = 'closed' GROUP BY category ORDER BY n DESC LIMIT 1`).get(guildId) as { category: string } | undefined;
  const lastClosed = db.prepare(`SELECT * FROM tickets WHERE guild_id = ? AND status = 'closed' ORDER BY COALESCE(closed_at, created_at) DESC LIMIT 1`).get(guildId) as Ticket | undefined;

  return { total, thisWeek, thisMonth, topCategory: topRow?.category ?? null, lastClosed };
}

/**
 * Atomisch eine Discord Message-ID beanspruchen.
 * Gibt true zurück wenn diese Instanz die Nachricht als erste claimed hat.
 * Gibt false zurück wenn eine andere Instanz sie bereits verarbeitet.
 * Räumt Einträge älter als 5 Minuten bei jedem Aufruf auf.
 */
export function claimMessage(messageId: string): boolean {
  const db = getDb();
  try {
    db.prepare(`INSERT INTO msg_dedup (id, ts) VALUES (?, ?)`).run(messageId, Date.now());
    // Best-effort cleanup alter Einträge (> 5 Minuten)
    db.prepare(`DELETE FROM msg_dedup WHERE ts < ?`).run(Date.now() - 300_000);
    return true;
  } catch {
    // UNIQUE-Constraint verletzt → bereits von einer anderen Instanz verarbeitet
    return false;
  }
}
