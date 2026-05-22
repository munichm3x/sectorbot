import type { Client, GuildScheduledEvent, PartialGuildScheduledEvent } from 'discord.js';
import { GuildScheduledEventStatus } from 'discord.js';
import { logger } from '../../utils/logger';
import { getDb, createPublicEvent, updatePublicEvent } from '../../db/index';
import { isRecentOutbound } from '../../services/discordSync';

function statusFromDiscord(s: GuildScheduledEventStatus | null): string {
  switch (s) {
    case GuildScheduledEventStatus.Scheduled: return 'scheduled';
    case GuildScheduledEventStatus.Active:    return 'live';
    case GuildScheduledEventStatus.Completed: return 'ended';
    case GuildScheduledEventStatus.Canceled:  return 'cancelled';
    default: return 'scheduled';
  }
}

function inferEventType(name: string, description: string | null): string {
  const txt = `${name} ${description ?? ''}`.toLowerCase();
  if (txt.includes('pvp'))                           return 'pvp';
  if (txt.includes('raid'))                          return 'raid';
  if (txt.includes('solo'))                          return 'solo';
  if (txt.includes('airfield'))                      return 'airfield';
  if (txt.includes('bunker'))                        return 'bunker';
  if (txt.includes('trader'))                        return 'trader';
  if (txt.includes('meeting') || txt.includes('treffen')) return 'meeting';
  if (txt.includes('wipe'))                          return 'wipe';
  return 'community';
}

function findEventByDiscordId(guildId: string, discordEventId: string): { id: number } | undefined {
  return getDb()
    .prepare('SELECT * FROM public_events WHERE guild_id = ? AND discord_event_id = ? LIMIT 1')
    .get(guildId, discordEventId) as { id: number } | undefined;
}

async function syncEventToDb(ev: GuildScheduledEvent): Promise<void> {
  if (isRecentOutbound(`event:${ev.id}`)) return; // we just wrote this from dashboard — skip
  if (!ev.guild) return;

  const guildId     = ev.guild.id;
  const status      = statusFromDiscord(ev.status);
  const startsAt    = ev.scheduledStartTimestamp
    ? Math.floor(ev.scheduledStartTimestamp / 1000)
    : Math.floor(Date.now() / 1000);
  const endsAt      = ev.scheduledEndTimestamp
    ? Math.floor(ev.scheduledEndTimestamp / 1000)
    : null;
  const description = ev.description ?? null;
  const eventType   = inferEventType(ev.name, description);
  const banner      = ev.coverImageURL({ size: 1024 }) || null;

  const existing = findEventByDiscordId(guildId, ev.id);
  if (existing) {
    updatePublicEvent(existing.id, {
      title:       ev.name,
      description,
      event_type:  eventType,
      starts_at:   startsAt,
      ends_at:     endsAt,
      status,
      banner_url:  banner,
      updated_by:  'discord:sync',
    });
  } else {
    const row = createPublicEvent({
      guild_id:       guildId,
      title:          ev.name,
      description,
      event_type:     eventType,
      starts_at:      startsAt,
      ends_at:        endsAt,
      status,
      discord_url:    null,
      banner_url:     banner,
      public_visible: 1,
      created_by:     'discord:sync',
    });
    if (row && typeof row === 'object' && 'id' in row) {
      getDb()
        .prepare('UPDATE public_events SET discord_event_id = ? WHERE id = ?')
        .run(ev.id, (row as { id: number }).id);
    }
  }
}

function handleEventDelete(ev: GuildScheduledEvent | PartialGuildScheduledEvent): void {
  if (isRecentOutbound(`event:${ev.id}`)) return;
  if (!ev.guild) return;

  const existing = findEventByDiscordId(ev.guild.id, ev.id);
  if (existing) {
    updatePublicEvent(existing.id, { status: 'cancelled', updated_by: 'discord:sync' });
  }
}

export function registerEventSyncListeners(client: Client): void {
  client.on('guildScheduledEventCreate', (ev) => {
    syncEventToDb(ev).catch(err => logger.error('[sync] scheduledEventCreate error:', err));
  });

  client.on('guildScheduledEventUpdate', (_old, neu) => {
    if (!neu) return;
    syncEventToDb(neu).catch(err => logger.error('[sync] scheduledEventUpdate error:', err));
  });

  client.on('guildScheduledEventDelete', (ev) => {
    try { handleEventDelete(ev); }
    catch (err) { logger.error('[sync] scheduledEventDelete error:', err); }
  });

  logger.info('[sync] Discord scheduled-event listeners registered.');
}
