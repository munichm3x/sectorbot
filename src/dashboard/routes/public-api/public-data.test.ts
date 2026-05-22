import { describe, expect, test } from 'vitest';
import {
  buildEmptyContentPayload,
  buildRulesPayload,
  buildWhitelistStatus,
  sanitizeStatusHistory,
} from './public-data';

describe('public dashboard DTO helpers', () => {
  test('buildRulesPayload returns categorized real sector rules', () => {
    const payload = buildRulesPayload();

    expect(payload.categories.length).toBeGreaterThan(5);
    expect(payload.categories.map(c => c.title)).toContain('Teams & Gruppierungen');
    expect(payload.categories.map(c => c.title)).toContain('Einzelkämpfer / Orange Solo');
    expect(payload.categories.flatMap(c => c.rules).join('\n')).toContain('maximal 4 Spielern');
    expect(payload.categories.flatMap(c => c.rules).join('\n')).toContain('Orange');
  });

  test('buildEmptyContentPayload returns stable empty public content structures', () => {
    const payload = buildEmptyContentPayload();

    expect(payload.events).toEqual([]);
    expect(payload.announcements).toEqual([]);
    expect(payload.changelog).toEqual([]);
    expect(payload.faq).toEqual([]);
  });

  test('sanitizeStatusHistory excludes internal status error details', () => {
    const history = sanitizeStatusHistory([
      {
        id: 1,
        guild_id: 'guild',
        online: 0,
        players_online: null,
        max_players: null,
        ping: null,
        error: 'ECONNREFUSED internal host detail',
        checked_at: 123,
      },
    ]);

    expect(history).toEqual([
      {
        online: false,
        playersOnline: null,
        maxPlayers: null,
        ping: null,
        checkedAt: 123,
      },
    ]);
    expect(JSON.stringify(history)).not.toContain('ECONNREFUSED');
  });

  test('buildWhitelistStatus reports login requirement without user session', () => {
    const payload = buildWhitelistStatus(null, null);

    expect(payload).toEqual({
      authenticated: false,
      loginRequired: true,
      configured: false,
      approved: null,
      nextStep: 'Melde dich mit Discord an, um deinen Whitelist-Status zu sehen.',
    });
  });
});
