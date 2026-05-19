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
