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
  CREATE_RULES_TABLE, CREATE_RULES_INDEX,
  CREATE_PUBLIC_EVENTS_TABLE, CREATE_PUBLIC_EVENTS_INDEX,
  CREATE_CHANGELOG_ENTRIES_TABLE, CREATE_CHANGELOG_ENTRIES_INDEX,
  CREATE_PUBLIC_ANNOUNCEMENTS_TABLE, CREATE_PUBLIC_ANNOUNCEMENTS_INDEX,
  CREATE_FAQ_ITEMS_TABLE, CREATE_FAQ_ITEMS_INDEX,
  CREATE_BOT_SETTINGS_TABLE, CREATE_BOT_SETTINGS_INDEX,
  CREATE_WIPE_INFO_TABLE,
  CREATE_SERVER_PUBLIC_INFO_TABLE,
  CREATE_TICKET_NOTES_TABLE,
  CREATE_TICKET_NOTES_INDEX,
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
import type { Ticket, Panel, GuildConfig, TicketCategoryConfig, ChangelogConfig, ScumStatusConfig, RuleEntry, PublicEvent, ChangelogEntry, PublicAnnouncement, FaqItem, BotSetting, WipeInfo, ServerPublicInfo } from '../types';
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
  // Ticket-System Verbesserungen (2026-05-22)
  try { db.exec(`ALTER TABLE tickets ADD COLUMN priority           TEXT    NOT NULL DEFAULT 'medium'`); } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE tickets ADD COLUMN close_reason       TEXT`);                              } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE tickets ADD COLUMN tags               TEXT`);                              } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE tickets ADD COLUMN transcript_path    TEXT`);                              } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE tickets ADD COLUMN archived_at        INTEGER`);                           } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE tickets ADD COLUMN welcome_message_id TEXT`);                              } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE tickets ADD COLUMN summary_json TEXT`); } catch { /* already exists */ }
  db.exec(CREATE_TICKET_NOTES_TABLE);
  db.exec(CREATE_TICKET_NOTES_INDEX);
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
  db.exec(CREATE_RULES_TABLE);
  db.exec(CREATE_RULES_INDEX);
  db.exec(CREATE_PUBLIC_EVENTS_TABLE);
  db.exec(CREATE_PUBLIC_EVENTS_INDEX);
  db.exec(CREATE_CHANGELOG_ENTRIES_TABLE);
  db.exec(CREATE_CHANGELOG_ENTRIES_INDEX);
  db.exec(CREATE_PUBLIC_ANNOUNCEMENTS_TABLE);
  db.exec(CREATE_PUBLIC_ANNOUNCEMENTS_INDEX);
  db.exec(CREATE_FAQ_ITEMS_TABLE);
  db.exec(CREATE_FAQ_ITEMS_INDEX);
  db.exec(CREATE_BOT_SETTINGS_TABLE);
  db.exec(CREATE_BOT_SETTINGS_INDEX);
  db.exec(CREATE_WIPE_INFO_TABLE);
  db.exec(CREATE_SERVER_PUBLIC_INFO_TABLE);
  try { db.exec(`ALTER TABLE public_events ADD COLUMN discord_event_id TEXT`); } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE public_announcements ADD COLUMN discord_message_id TEXT`); } catch { /* already exists */ }
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
  channelId:    string,
  closedBy:     string,
  messageCount: number,
  summary:      string,
  closeReason?: string,
  summaryJson?: string | null,
): void {
  getDb()
    .prepare(`
      UPDATE tickets
      SET closed_by = ?, message_count = ?, summary = ?,
          close_reason = COALESCE(?, close_reason),
          summary_json = COALESCE(?, summary_json)
      WHERE channel_id = ?
    `)
    .run(
      closedBy,
      messageCount,
      summary.slice(0, 2000),
      closeReason ?? null,
      summaryJson ?? null,
      channelId,
    );
}

// ─── Ticket — neue Felder ─────────────────────────────────────────────────────

export function setTicketPriority(channelId: string, priority: string): void {
  getDb()
    .prepare(`UPDATE tickets SET priority = ? WHERE channel_id = ?`)
    .run(priority, channelId);
}

export function setTicketCloseReason(channelId: string, reason: string): void {
  getDb()
    .prepare(`UPDATE tickets SET close_reason = ? WHERE channel_id = ?`)
    .run(reason, channelId);
}

export function setTicketTags(channelId: string, tags: string): void {
  getDb()
    .prepare(`UPDATE tickets SET tags = ? WHERE channel_id = ?`)
    .run(tags, channelId);
}

export function setTranscriptPath(channelId: string, transcriptPath: string): void {
  getDb()
    .prepare(`UPDATE tickets SET transcript_path = ? WHERE channel_id = ?`)
    .run(transcriptPath, channelId);
}

export function setArchivedAt(channelId: string, timestamp: number): void {
  getDb()
    .prepare(`UPDATE tickets SET archived_at = ? WHERE channel_id = ?`)
    .run(timestamp, channelId);
}

export function setWelcomeMessageId(channelId: string, messageId: string): void {
  getDb()
    .prepare(`UPDATE tickets SET welcome_message_id = ? WHERE channel_id = ?`)
    .run(messageId, channelId);
}

// ─── Ticket — erweiterte Abfragen ─────────────────────────────────────────────

export interface TicketFilters {
  status?:    string;
  priority?:  string;
  category?:  string;
  claimedBy?: string;
  creator?:   string;
  dateFrom?:  number;
  dateTo?:    number;
  tags?:      string;
  search?:    string;
}

function escapeLike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function buildTicketFilterQuery(
  guildId: string,
  filters: TicketFilters,
  count = false,
): { sql: string; params: unknown[] } {
  const conditions: string[] = ['guild_id = ?'];
  const params: unknown[]    = [guildId];

  if (filters.status && filters.status !== 'all') {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.priority) {
    conditions.push('priority = ?');
    params.push(filters.priority);
  }
  if (filters.category) {
    conditions.push('category = ?');
    params.push(filters.category);
  }
  if (filters.claimedBy) {
    conditions.push('claimed_by = ?');
    params.push(filters.claimedBy);
  }
  if (filters.creator) {
    conditions.push('opener_user_id = ?');
    params.push(filters.creator);
  }
  if (filters.dateFrom) {
    conditions.push('COALESCE(closed_at, created_at) >= ?');
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push('COALESCE(closed_at, created_at) <= ?');
    params.push(filters.dateTo);
  }
  if (filters.tags) {
    conditions.push("tags LIKE ? ESCAPE '\\\\'");
    params.push(`%${escapeLike(filters.tags)}%`);
  }
  if (filters.search) {
    const like = `%${escapeLike(filters.search)}%`;
    conditions.push(
      "(CAST(id AS TEXT) LIKE ? ESCAPE '\\\\' OR opener_user_id LIKE ? ESCAPE '\\\\' OR closed_by LIKE ? ESCAPE '\\\\' OR " +
      "category LIKE ? ESCAPE '\\\\' OR summary LIKE ? ESCAPE '\\\\' OR username_snapshot LIKE ? ESCAPE '\\\\' OR closed_by_username_snapshot LIKE ? ESCAPE '\\\\')"
    );
    params.push(like, like, like, like, like, like, like);
  }

  const where = conditions.join(' AND ');
  const sql   = count
    ? `SELECT COUNT(*) AS n FROM tickets WHERE ${where}`
    : `SELECT * FROM tickets WHERE ${where}`;
  return { sql, params };
}

export function getFilteredTickets(
  guildId: string,
  filters: TicketFilters,
  limit:   number,
  offset:  number,
): Ticket[] {
  const { sql, params } = buildTicketFilterQuery(guildId, filters);
  return getDb()
    .prepare(`${sql} ORDER BY COALESCE(closed_at, created_at) DESC LIMIT ? OFFSET ?`)
    .all([...params, limit, offset]) as Ticket[];
}

export function countFilteredTickets(guildId: string, filters: TicketFilters): number {
  const { sql, params } = buildTicketFilterQuery(guildId, filters, true);
  const row = getDb().prepare(sql).get(params) as { n: number };
  return row.n;
}

// ─── Ticket Notes ─────────────────────────────────────────────────────────────

export interface TicketNoteRow {
  id:         number;
  ticket_id:  number;
  guild_id:   string;
  author_id:  string;
  author_tag: string;
  content:    string;
  created_at: number;
}

export function createTicketNote(data: Omit<TicketNoteRow, 'id'>): TicketNoteRow {
  const result = getDb()
    .prepare(`
      INSERT INTO ticket_notes (ticket_id, guild_id, author_id, author_tag, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(data.ticket_id, data.guild_id, data.author_id, data.author_tag, data.content, data.created_at);
  return getDb()
    .prepare(`SELECT * FROM ticket_notes WHERE id = ?`)
    .get(result.lastInsertRowid) as TicketNoteRow;
}

export function getTicketNotes(ticketId: number, guildId: string): TicketNoteRow[] {
  return getDb()
    .prepare(`SELECT * FROM ticket_notes WHERE ticket_id = ? AND guild_id = ? ORDER BY created_at ASC`)
    .all(ticketId, guildId) as TicketNoteRow[];
}

export function deleteTicketNote(noteId: number, guildId: string): void {
  getDb()
    .prepare(`DELETE FROM ticket_notes WHERE id = ? AND guild_id = ?`)
    .run(noteId, guildId);
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

// ─── Rules ───────────────────────────────────────────────────────────────────

export function listRules(guildId: string, opts?: { publicOnly?: boolean }): RuleEntry[] {
  const where = opts?.publicOnly ? 'WHERE guild_id = ? AND public_visible = 1' : 'WHERE guild_id = ?';
  return getDb().prepare(`SELECT * FROM rules ${where} ORDER BY category, sort_order, id`).all(guildId) as RuleEntry[];
}

export function getRule(id: number): RuleEntry | null {
  return getDb().prepare('SELECT * FROM rules WHERE id = ?').get(id) as RuleEntry | undefined ?? null;
}

export function createRule(input: { guild_id: string; category: string; title: string; body: string; sort_order?: number; public_visible?: number; created_by?: string | null }): RuleEntry {
  const now = Math.floor(Date.now() / 1000);
  const result = getDb().prepare(`
    INSERT INTO rules (guild_id, category, title, body, sort_order, public_visible, created_by, updated_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.guild_id, input.category, input.title, input.body,
    input.sort_order ?? 0, input.public_visible ?? 1,
    input.created_by ?? null, input.created_by ?? null, now, now,
  );
  return getRule(Number(result.lastInsertRowid))!;
}

export function updateRule(id: number, patch: { category?: string; title?: string; body?: string; sort_order?: number; public_visible?: number; updated_by?: string | null }): RuleEntry | null {
  const existing = getRule(id);
  if (!existing) return null;
  const now = Math.floor(Date.now() / 1000);
  getDb().prepare(`
    UPDATE rules SET
      category = COALESCE(?, category),
      title = COALESCE(?, title),
      body = COALESCE(?, body),
      sort_order = COALESCE(?, sort_order),
      public_visible = COALESCE(?, public_visible),
      updated_by = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    patch.category ?? null, patch.title ?? null, patch.body ?? null,
    patch.sort_order ?? null, patch.public_visible ?? null,
    patch.updated_by ?? null, now, id,
  );
  return getRule(id);
}

export function deleteRule(id: number): boolean {
  const result = getDb().prepare('DELETE FROM rules WHERE id = ?').run(id);
  return result.changes > 0;
}

export function reorderRules(guildId: string, category: string, orderedIds: number[]): void {
  const stmt = getDb().prepare('UPDATE rules SET sort_order = ? WHERE id = ? AND guild_id = ? AND category = ?');
  const txn = getDb().transaction((ids: number[]) => {
    ids.forEach((id, idx) => stmt.run(idx, id, guildId, category));
  });
  txn(orderedIds);
}

// ─── Public Events ────────────────────────────────────────────────────────────

export function listPublicEvents(guildId: string, opts?: { publicOnly?: boolean }): PublicEvent[] {
  const where = opts?.publicOnly ? 'WHERE guild_id = ? AND public_visible = 1' : 'WHERE guild_id = ?';
  return getDb().prepare(`SELECT * FROM public_events ${where} ORDER BY starts_at`).all(guildId) as PublicEvent[];
}

export function getPublicEvent(id: number): PublicEvent | null {
  return getDb().prepare('SELECT * FROM public_events WHERE id = ?').get(id) as PublicEvent | undefined ?? null;
}

export function createPublicEvent(input: { guild_id: string; title: string; description?: string | null; event_type?: string; starts_at: number; ends_at?: number | null; status?: string; discord_url?: string | null; banner_url?: string | null; public_visible?: number; created_by?: string | null }): PublicEvent {
  const now = Math.floor(Date.now() / 1000);
  const result = getDb().prepare(`
    INSERT INTO public_events (guild_id, title, description, event_type, starts_at, ends_at, status, discord_url, banner_url, public_visible, created_by, updated_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.guild_id, input.title, input.description ?? null,
    input.event_type ?? 'community', input.starts_at, input.ends_at ?? null,
    input.status ?? 'scheduled', input.discord_url ?? null, input.banner_url ?? null,
    input.public_visible ?? 1, input.created_by ?? null, input.created_by ?? null, now, now,
  );
  return getPublicEvent(Number(result.lastInsertRowid))!;
}

export function updatePublicEvent(id: number, patch: { title?: string; description?: string | null; event_type?: string; starts_at?: number; ends_at?: number | null; status?: string; discord_url?: string | null; banner_url?: string | null; public_visible?: number; updated_by?: string | null }): PublicEvent | null {
  const existing = getPublicEvent(id);
  if (!existing) return null;
  const now = Math.floor(Date.now() / 1000);
  getDb().prepare(`
    UPDATE public_events SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      event_type = COALESCE(?, event_type),
      starts_at = COALESCE(?, starts_at),
      ends_at = COALESCE(?, ends_at),
      status = COALESCE(?, status),
      discord_url = COALESCE(?, discord_url),
      banner_url = COALESCE(?, banner_url),
      public_visible = COALESCE(?, public_visible),
      updated_by = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    patch.title ?? null, patch.description ?? null, patch.event_type ?? null,
    patch.starts_at ?? null, patch.ends_at ?? null, patch.status ?? null,
    patch.discord_url ?? null, patch.banner_url ?? null, patch.public_visible ?? null,
    patch.updated_by ?? null, now, id,
  );
  return getPublicEvent(id);
}

export function deletePublicEvent(id: number): boolean {
  const result = getDb().prepare('DELETE FROM public_events WHERE id = ?').run(id);
  return result.changes > 0;
}

// ─── Changelog Entries ────────────────────────────────────────────────────────

export function listChangelogEntries(guildId: string, opts?: { publicOnly?: boolean }): ChangelogEntry[] {
  const where = opts?.publicOnly ? 'WHERE guild_id = ? AND public_visible = 1' : 'WHERE guild_id = ?';
  return getDb().prepare(`SELECT * FROM changelog_entries ${where} ORDER BY published_at DESC, id DESC`).all(guildId) as ChangelogEntry[];
}

export function getChangelogEntry(id: number): ChangelogEntry | null {
  return getDb().prepare('SELECT * FROM changelog_entries WHERE id = ?').get(id) as ChangelogEntry | undefined ?? null;
}

export function createChangelogEntry(input: { guild_id: string; title: string; body: string; category?: string; version?: string | null; status?: string; public_visible?: number; created_by?: string | null }): ChangelogEntry {
  const now = Math.floor(Date.now() / 1000);
  const result = getDb().prepare(`
    INSERT INTO changelog_entries (guild_id, title, body, category, version, status, published_at, discord_message_id, public_visible, created_by, updated_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?)
  `).run(
    input.guild_id, input.title, input.body,
    input.category ?? 'server', input.version ?? null,
    input.status ?? 'draft', input.public_visible ?? 1,
    input.created_by ?? null, input.created_by ?? null, now, now,
  );
  return getChangelogEntry(Number(result.lastInsertRowid))!;
}

export function updateChangelogEntry(id: number, patch: { title?: string; body?: string; category?: string; version?: string | null; status?: string; public_visible?: number; updated_by?: string | null }): ChangelogEntry | null {
  const existing = getChangelogEntry(id);
  if (!existing) return null;
  const now = Math.floor(Date.now() / 1000);
  getDb().prepare(`
    UPDATE changelog_entries SET
      title = COALESCE(?, title),
      body = COALESCE(?, body),
      category = COALESCE(?, category),
      version = COALESCE(?, version),
      status = COALESCE(?, status),
      public_visible = COALESCE(?, public_visible),
      updated_by = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    patch.title ?? null, patch.body ?? null, patch.category ?? null,
    patch.version ?? null, patch.status ?? null, patch.public_visible ?? null,
    patch.updated_by ?? null, now, id,
  );
  return getChangelogEntry(id);
}

export function deleteChangelogEntry(id: number): boolean {
  const result = getDb().prepare('DELETE FROM changelog_entries WHERE id = ?').run(id);
  return result.changes > 0;
}

export function publishChangelog(id: number, publishedAt: number, discordMessageId: string | null): ChangelogEntry | null {
  const existing = getChangelogEntry(id);
  if (!existing) return null;
  const now = Math.floor(Date.now() / 1000);
  getDb().prepare(`
    UPDATE changelog_entries SET
      status = 'published',
      published_at = ?,
      discord_message_id = ?,
      updated_at = ?
    WHERE id = ?
  `).run(publishedAt, discordMessageId, now, id);
  return getChangelogEntry(id);
}

// ─── Public Announcements ─────────────────────────────────────────────────────

export function listPublicAnnouncements(guildId: string, opts?: { publicOnly?: boolean; activeOnly?: boolean }): PublicAnnouncement[] {
  let where = 'WHERE guild_id = ?';
  if (opts?.publicOnly) where += ' AND public_visible = 1';
  if (opts?.activeOnly) where += ' AND active = 1';
  return getDb().prepare(`SELECT * FROM public_announcements ${where} ORDER BY priority DESC, starts_at`).all(guildId) as PublicAnnouncement[];
}

export function getPublicAnnouncement(id: number): PublicAnnouncement | null {
  return getDb().prepare('SELECT * FROM public_announcements WHERE id = ?').get(id) as PublicAnnouncement | undefined ?? null;
}

export function createPublicAnnouncement(input: { guild_id: string; title: string; body: string; announcement_type?: string; priority?: number; starts_at: number; ends_at?: number | null; show_as_banner?: number; active?: number; public_visible?: number; created_by?: string | null }): PublicAnnouncement {
  const now = Math.floor(Date.now() / 1000);
  const result = getDb().prepare(`
    INSERT INTO public_announcements (guild_id, title, body, announcement_type, priority, starts_at, ends_at, show_as_banner, active, public_visible, created_by, updated_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.guild_id, input.title, input.body,
    input.announcement_type ?? 'info', input.priority ?? 0,
    input.starts_at, input.ends_at ?? null,
    input.show_as_banner ?? 0, input.active ?? 1,
    input.public_visible ?? 1, input.created_by ?? null, input.created_by ?? null, now, now,
  );
  return getPublicAnnouncement(Number(result.lastInsertRowid))!;
}

export function updatePublicAnnouncement(id: number, patch: { title?: string; body?: string; announcement_type?: string; priority?: number; starts_at?: number; ends_at?: number | null; show_as_banner?: number; active?: number; public_visible?: number; updated_by?: string | null }): PublicAnnouncement | null {
  const existing = getPublicAnnouncement(id);
  if (!existing) return null;
  const now = Math.floor(Date.now() / 1000);
  getDb().prepare(`
    UPDATE public_announcements SET
      title = COALESCE(?, title),
      body = COALESCE(?, body),
      announcement_type = COALESCE(?, announcement_type),
      priority = COALESCE(?, priority),
      starts_at = COALESCE(?, starts_at),
      ends_at = COALESCE(?, ends_at),
      show_as_banner = COALESCE(?, show_as_banner),
      active = COALESCE(?, active),
      public_visible = COALESCE(?, public_visible),
      updated_by = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    patch.title ?? null, patch.body ?? null, patch.announcement_type ?? null,
    patch.priority ?? null, patch.starts_at ?? null, patch.ends_at ?? null,
    patch.show_as_banner ?? null, patch.active ?? null, patch.public_visible ?? null,
    patch.updated_by ?? null, now, id,
  );
  return getPublicAnnouncement(id);
}

export function deletePublicAnnouncement(id: number): boolean {
  const result = getDb().prepare('DELETE FROM public_announcements WHERE id = ?').run(id);
  return result.changes > 0;
}

// ─── FAQ Items ────────────────────────────────────────────────────────────────

export function listFaqItems(guildId: string, opts?: { publicOnly?: boolean }): FaqItem[] {
  const where = opts?.publicOnly ? 'WHERE guild_id = ? AND public_visible = 1' : 'WHERE guild_id = ?';
  return getDb().prepare(`SELECT * FROM faq_items ${where} ORDER BY category, sort_order, id`).all(guildId) as FaqItem[];
}

export function getFaqItem(id: number): FaqItem | null {
  return getDb().prepare('SELECT * FROM faq_items WHERE id = ?').get(id) as FaqItem | undefined ?? null;
}

export function createFaqItem(input: { guild_id: string; category: string; question: string; answer: string; sort_order?: number; public_visible?: number; created_by?: string | null }): FaqItem {
  const now = Math.floor(Date.now() / 1000);
  const result = getDb().prepare(`
    INSERT INTO faq_items (guild_id, category, question, answer, sort_order, public_visible, created_by, updated_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.guild_id, input.category, input.question, input.answer,
    input.sort_order ?? 0, input.public_visible ?? 1,
    input.created_by ?? null, input.created_by ?? null, now, now,
  );
  return getFaqItem(Number(result.lastInsertRowid))!;
}

export function updateFaqItem(id: number, patch: { category?: string; question?: string; answer?: string; sort_order?: number; public_visible?: number; updated_by?: string | null }): FaqItem | null {
  const existing = getFaqItem(id);
  if (!existing) return null;
  const now = Math.floor(Date.now() / 1000);
  getDb().prepare(`
    UPDATE faq_items SET
      category = COALESCE(?, category),
      question = COALESCE(?, question),
      answer = COALESCE(?, answer),
      sort_order = COALESCE(?, sort_order),
      public_visible = COALESCE(?, public_visible),
      updated_by = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    patch.category ?? null, patch.question ?? null, patch.answer ?? null,
    patch.sort_order ?? null, patch.public_visible ?? null,
    patch.updated_by ?? null, now, id,
  );
  return getFaqItem(id);
}

export function deleteFaqItem(id: number): boolean {
  const result = getDb().prepare('DELETE FROM faq_items WHERE id = ?').run(id);
  return result.changes > 0;
}

export function reorderFaqItems(guildId: string, category: string, orderedIds: number[]): void {
  const stmt = getDb().prepare('UPDATE faq_items SET sort_order = ? WHERE id = ? AND guild_id = ? AND category = ?');
  const txn = getDb().transaction((ids: number[]) => {
    ids.forEach((id, idx) => stmt.run(idx, id, guildId, category));
  });
  txn(orderedIds);
}

// ─── Bot Settings ─────────────────────────────────────────────────────────────

function maskSetting(row: BotSetting): BotSetting {
  if (row.is_secret === 1 && row.setting_value !== null) {
    return { ...row, setting_value: '***' };
  }
  return row;
}

export function listSettings(guildId: string, category: string, opts?: { includeSecrets?: boolean }): BotSetting[] {
  const rows = getDb().prepare('SELECT * FROM bot_settings WHERE guild_id = ? AND category = ?').all(guildId, category) as BotSetting[];
  if (opts?.includeSecrets) return rows;
  return rows.map(maskSetting);
}

export function getSetting(guildId: string, category: string, key: string): BotSetting | null {
  const row = getDb().prepare('SELECT * FROM bot_settings WHERE guild_id = ? AND category = ? AND setting_key = ?').get(guildId, category, key) as BotSetting | undefined;
  if (!row) return null;
  return maskSetting(row);
}

export function getSettingRaw(guildId: string, category: string, key: string): BotSetting | null {
  return getDb().prepare('SELECT * FROM bot_settings WHERE guild_id = ? AND category = ? AND setting_key = ?').get(guildId, category, key) as BotSetting | undefined ?? null;
}

export function upsertSetting(input: { guildId: string; category: string; key: string; value: string | null; isSecret?: number; updatedBy?: string | null }): BotSetting {
  const now = Math.floor(Date.now() / 1000);
  getDb().prepare(`
    INSERT INTO bot_settings (guild_id, category, setting_key, setting_value, is_secret, updated_by, updated_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, category, setting_key) DO UPDATE SET
      setting_value = excluded.setting_value,
      is_secret     = COALESCE(excluded.is_secret, is_secret),
      updated_by    = excluded.updated_by,
      updated_at    = excluded.updated_at
  `).run(
    input.guildId, input.category, input.key,
    input.value, input.isSecret ?? 0, input.updatedBy ?? null, now, now,
  );
  return getSetting(input.guildId, input.category, input.key)!;
}

export function deleteSetting(guildId: string, category: string, key: string): boolean {
  const result = getDb().prepare('DELETE FROM bot_settings WHERE guild_id = ? AND category = ? AND setting_key = ?').run(guildId, category, key);
  return result.changes > 0;
}

// ─── Wipe Info ────────────────────────────────────────────────────────────────

export function getWipeInfo(guildId: string): WipeInfo | null {
  return getDb().prepare('SELECT * FROM wipe_info WHERE guild_id = ?').get(guildId) as WipeInfo | undefined ?? null;
}

export function upsertWipeInfo(input: { guildId: string; currentSeason?: number | null; seasonName?: string | null; lastWipeAt?: number | null; lastWipeType?: string | null; nextWipeAt?: number | null; nextWipeType?: string | null; notes?: string | null; publicVisible?: number; updatedBy?: string | null }): WipeInfo {
  const now = Math.floor(Date.now() / 1000);
  getDb().prepare(`
    INSERT INTO wipe_info (guild_id, current_season, season_name, last_wipe_at, last_wipe_type, next_wipe_at, next_wipe_type, notes, public_visible, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      current_season = COALESCE(excluded.current_season, current_season),
      season_name    = COALESCE(excluded.season_name,    season_name),
      last_wipe_at   = COALESCE(excluded.last_wipe_at,   last_wipe_at),
      last_wipe_type = COALESCE(excluded.last_wipe_type, last_wipe_type),
      next_wipe_at   = COALESCE(excluded.next_wipe_at,   next_wipe_at),
      next_wipe_type = COALESCE(excluded.next_wipe_type, next_wipe_type),
      notes          = COALESCE(excluded.notes,          notes),
      public_visible = COALESCE(excluded.public_visible, public_visible),
      updated_by     = excluded.updated_by,
      updated_at     = excluded.updated_at
  `).run(
    input.guildId,
    input.currentSeason ?? null, input.seasonName ?? null,
    input.lastWipeAt ?? null, input.lastWipeType ?? null,
    input.nextWipeAt ?? null, input.nextWipeType ?? null,
    input.notes ?? null, input.publicVisible ?? 1,
    input.updatedBy ?? null, now,
  );
  return getWipeInfo(input.guildId)!;
}

// ─── Server Public Info ───────────────────────────────────────────────────────

export function getServerPublicInfo(guildId: string): ServerPublicInfo | null {
  return getDb().prepare('SELECT * FROM server_public_info WHERE guild_id = ?').get(guildId) as ServerPublicInfo | undefined ?? null;
}

export function upsertServerPublicInfo(input: { guildId: string; serverName?: string | null; description?: string | null; gameMode?: string | null; maxTeamSize?: number | null; soloColor?: string | null; lootRate?: string | null; safezones?: number | null; permadeath?: number | null; vehicleLimit?: string | null; baseLimit?: string | null; restartTimes?: string | null; mapRegion?: string | null; joinHint?: string | null; showHostInPublic?: number; updatedBy?: string | null }): ServerPublicInfo {
  const now = Math.floor(Date.now() / 1000);
  getDb().prepare(`
    INSERT INTO server_public_info (guild_id, server_name, description, game_mode, max_team_size, solo_color, loot_rate, safezones, permadeath, vehicle_limit, base_limit, restart_times, map_region, join_hint, show_host_in_public, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      server_name         = COALESCE(excluded.server_name,         server_name),
      description         = COALESCE(excluded.description,         description),
      game_mode           = COALESCE(excluded.game_mode,           game_mode),
      max_team_size       = COALESCE(excluded.max_team_size,       max_team_size),
      solo_color          = COALESCE(excluded.solo_color,          solo_color),
      loot_rate           = COALESCE(excluded.loot_rate,           loot_rate),
      safezones           = COALESCE(excluded.safezones,           safezones),
      permadeath          = COALESCE(excluded.permadeath,          permadeath),
      vehicle_limit       = COALESCE(excluded.vehicle_limit,       vehicle_limit),
      base_limit          = COALESCE(excluded.base_limit,          base_limit),
      restart_times       = COALESCE(excluded.restart_times,       restart_times),
      map_region          = COALESCE(excluded.map_region,          map_region),
      join_hint           = COALESCE(excluded.join_hint,           join_hint),
      show_host_in_public = COALESCE(excluded.show_host_in_public, show_host_in_public),
      updated_by          = excluded.updated_by,
      updated_at          = excluded.updated_at
  `).run(
    input.guildId,
    input.serverName ?? null, input.description ?? null, input.gameMode ?? null,
    input.maxTeamSize ?? null, input.soloColor ?? null, input.lootRate ?? null,
    input.safezones ?? null, input.permadeath ?? null,
    input.vehicleLimit ?? null, input.baseLimit ?? null,
    input.restartTimes ?? null, input.mapRegion ?? null, input.joinHint ?? null,
    input.showHostInPublic ?? 0, input.updatedBy ?? null, now,
  );
  return getServerPublicInfo(input.guildId)!;
}
