// src/features/streamer/streamer.types.ts

export interface StreamerConfig {
  guild_id:                string;
  enabled:                 number;
  setup_completed:         number;
  streamer_role_id:        string | null;
  live_channel_id:         string | null;
  check_interval_seconds:  number;
  twitch_client_id:        string | null;
  twitch_client_secret:    string | null;
  youtube_api_key:         string | null;
  announcement_ping_type:  'none' | 'role' | 'everyone' | 'here';
  last_successful_check:   string | null;
  last_error:              string | null;
  created_at:              string;
  updated_at:              string;
}

export interface Streamer {
  id:                 number;
  guild_id:           string;
  discord_user_id:    string;
  twitch_username:    string | null;
  youtube_channel_id: string | null;
  enabled:            number;
  created_at:         string;
  updated_at:         string;
}

export interface StreamLiveState {
  id:                      number;
  guild_id:                string;
  discord_user_id:         string;
  platform:                'twitch' | 'youtube';
  is_live:                 number;
  last_stream_id:          string | null;
  last_live_url:           string | null;
  last_live_title:         string | null;
  announcement_message_id: string | null;
  last_checked_at:         string | null;
  last_announced_at:       string | null;
  created_at:              string;
  updated_at:              string;
}

export interface LiveResult {
  isLive:       boolean;
  streamId?:    string;
  title?:       string;
  gameName?:    string;
  viewerCount?: number;
  thumbnailUrl?: string;
  startedAt?:   string;
  url?:         string;
  userName?:    string;
}

export type PingType = 'none' | 'role' | 'everyone' | 'here';

// Wizard-State (in-memory, 30-min TTL)
export interface WizardState {
  step:                    number;
  streamer_role_id?:       string;
  live_channel_id?:        string;
  twitch_client_id?:       string;
  twitch_client_secret?:   string;
  youtube_api_key?:        string | null;
  check_interval_seconds?: number;
  announcement_ping_type?: PingType;
  expiresAt:               number;
}
