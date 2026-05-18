import { describe, it, expect } from 'vitest';
import { buildStatusEmbed } from './scumStatus.embed';

describe('buildStatusEmbed', () => {
  it('builds green online embed with player and ping fields', () => {
    const embed = buildStatusEmbed({
      online: true,
      serverName: 'Sector 13',
      players: 12,
      maxPlayers: 64,
      ping: 43,
    });

    const json = embed.toJSON();
    expect(json.color).toBe(0x57F287);
    expect(json.description).toContain('🟢');
    expect(json.fields?.some(f => f.name.includes('Spieler') && f.value.includes('12'))).toBe(true);
    expect(json.fields?.some(f => f.name.includes('Ping') && f.value.includes('43'))).toBe(true);
    expect(json.title).toBe('🖥️ Sector 13');
  });

  it('builds red offline embed with Nicht verfügbar fields', () => {
    const embed = buildStatusEmbed({ online: false });

    const json = embed.toJSON();
    expect(json.color).toBe(0xED4245);
    expect(json.description).toContain('🔴');
    expect(json.fields?.some(f => f.value === 'Nicht verfügbar')).toBe(true);
  });

  it('includes footer text', () => {
    const embed = buildStatusEmbed({ online: false });
    expect(embed.toJSON().footer?.text).toBe('Automatisches Server-Dashboard');
  });
});
