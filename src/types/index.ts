import type {
  ChatInputCommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ChannelSelectMenuInteraction,
  RoleSelectMenuInteraction,
  ModalSubmitInteraction,
  UserSelectMenuInteraction,
  SlashCommandBuilder,
} from 'discord.js';

export interface Ticket {
  id: number;
  guild_id: string;
  channel_id: string;
  opener_user_id: string;
  category: string;
  status: 'open' | 'closed';
  claimed_by: string | null;
  created_at: number;
  closed_at: number | null;
  last_activity_at?: number | null;
  // Migration columns (may be null on older records)
  closed_by?: string | null;
  message_count?: number | null;
  summary?: string | null;
  archive_message_id?: string | null;
  archive_channel_id?: string | null;
  username_snapshot?: string | null;
  closed_by_username_snapshot?: string | null;
  // Ticket-System Verbesserungen (migration columns — null on older records)
  priority?:           string | null;
  close_reason?:       string | null;
  tags?:               string | null;
  transcript_path?:    string | null;
  archived_at?:        number | null;
  welcome_message_id?: string | null;
}

export interface Panel {
  id: number;
  guild_id: string;
  type: 'tickets' | 'rules';
  channel_id: string;
  message_id: string;
}

export interface TicketCategory {
  id: string;
  label: string;
  description: string;
  emoji: string;
}

export interface GuildConfig {
  guild_id: string;
  ticket_panel_channel_id: string | null;
  ticket_category_id: string | null;
  ticket_log_channel_id: string | null;
  ticket_archive_channel_id: string | null;
  rules_channel_id: string | null;
  whitelist_role_id: string | null;
  ticket_panel_message_id: string | null;
  rules_message_id: string | null;
  setup_completed: number;
  created_at: number;
  updated_at: number;
}

export interface GuildSupportRole {
  id: number;
  guild_id: string;
  role_id: string;
}

export interface TicketCategoryConfig {
  id: number;
  guild_id: string;
  key: string;
  label: string;
  description: string;
  emoji: string;
  sort_order: number;
  enabled: number;
}

export interface DoctorCheck {
  name: string;
  status: 'ok' | 'warn' | 'error';
  detail: string;
}

export interface Command {
  data: Pick<SlashCommandBuilder, 'name' | 'toJSON'>;
  execute: (interaction: ChatInputCommandInteraction) => Promise<unknown>;
}

export interface ButtonHandler {
  prefix: string;
  execute: (interaction: ButtonInteraction, payload: string) => Promise<unknown>;
}

export interface SelectMenuHandler {
  prefix: string;
  execute: (interaction: StringSelectMenuInteraction, payload: string) => Promise<unknown>;
}

export interface ChannelSelectMenuHandler {
  prefix: string;
  execute: (interaction: ChannelSelectMenuInteraction, payload: string) => Promise<unknown>;
}

export interface RoleSelectMenuHandler {
  prefix: string;
  execute: (interaction: RoleSelectMenuInteraction, payload: string) => Promise<unknown>;
}

export interface ModalHandler {
  prefix: string;
  execute: (interaction: ModalSubmitInteraction, payload: string) => Promise<unknown>;
}

export interface UserSelectMenuHandler {
  prefix: string;
  execute: (interaction: UserSelectMenuInteraction, payload: string) => Promise<unknown>;
}

export interface ChangelogConfig {
  guild_id:          string;
  create_channel_id: string | null;
  public_channel_id: string | null;
  dashboard_msg_id:  string | null;
}

export interface ChangelogDraft {
  version:   string;
  title:     string;
  added:     string;
  changed:   string;
  fixed:     string;
  removed:   string;
  notes:     string;
  createdAt: number;
}

export interface ScumStatusConfig {
  guild_id:             string;
  enabled:              number;       // 1 = aktiv, 0 = deaktiviert (SQLite INTEGER)
  channel_id:           string | null;
  message_id:           string | null;
  host:                 string | null;
  query_port:           number | null;
  update_interval_secs: number;
  created_at:           string;
  updated_at:           string;
}

export interface RuleEntry {
  id: number;
  guild_id: string;
  category: string;
  title: string;
  body: string;
  sort_order: number;
  public_visible: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: number;
  updated_at: number;
}

export interface PublicEvent {
  id: number;
  guild_id: string;
  title: string;
  description: string | null;
  event_type: string;
  starts_at: number;
  ends_at: number | null;
  status: string;
  discord_url: string | null;
  banner_url: string | null;
  public_visible: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: number;
  updated_at: number;
  // Migration column — added by ALTER TABLE
  discord_event_id?: string | null;
}

export interface ChangelogEntry {
  id: number;
  guild_id: string;
  title: string;
  body: string;
  category: string;
  version: string | null;
  status: string;
  published_at: number | null;
  discord_message_id: string | null;
  public_visible: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: number;
  updated_at: number;
}

export interface PublicAnnouncement {
  id: number;
  guild_id: string;
  title: string;
  body: string;
  announcement_type: string;
  priority: number;
  starts_at: number;
  ends_at: number | null;
  show_as_banner: number;
  active: number;
  public_visible: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: number;
  updated_at: number;
  // Migration column — added by ALTER TABLE
  discord_message_id?: string | null;
}

export interface FaqItem {
  id: number;
  guild_id: string;
  category: string;
  question: string;
  answer: string;
  sort_order: number;
  public_visible: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: number;
  updated_at: number;
}

export interface BotSetting {
  id: number;
  guild_id: string;
  category: string;
  setting_key: string;
  setting_value: string | null;
  is_secret: number;
  updated_by: string | null;
  updated_at: number;
  created_at: number;
}

export interface WipeInfo {
  guild_id: string;
  current_season: number | null;
  season_name: string | null;
  last_wipe_at: number | null;
  last_wipe_type: string | null;
  next_wipe_at: number | null;
  next_wipe_type: string | null;
  notes: string | null;
  public_visible: number;
  updated_by: string | null;
  updated_at: number;
}

export interface ServerPublicInfo {
  guild_id: string;
  server_name: string | null;
  description: string | null;
  game_mode: string | null;
  max_team_size: number | null;
  solo_color: string | null;
  loot_rate: string | null;
  safezones: number | null;
  permadeath: number | null;
  vehicle_limit: string | null;
  base_limit: string | null;
  restart_times: string | null;
  map_region: string | null;
  join_hint: string | null;
  show_host_in_public: number;
  updated_by: string | null;
  updated_at: number;
}
