import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.hoisted(() => vi.fn());
vi.mock('gamedig', () => ({ default: mockQuery }));

import { queryServer } from './scumStatus.service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('queryServer', () => {
  it('returns online result with correct fields on success', async () => {
    mockQuery.mockResolvedValueOnce({
      name: 'Sector 13 Server',
      map: '',
      password: false,
      maxplayers: 64,
      players: Array.from({ length: 12 }, () => ({ name: 'player' })),
      bots: [],
      connect: '1.2.3.4:7042',
      ping: 43,
    });

    const result = await queryServer('1.2.3.4', 27015);

    expect(result.online).toBe(true);
    if (result.online) {
      expect(result.players).toBe(12);
      expect(result.maxPlayers).toBe(64);
      expect(result.ping).toBe(43);
      expect(result.serverName).toBe('Sector 13 Server');
    }
  });

  it('returns offline result when query throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('Connection refused'));
    const result = await queryServer('1.2.3.4', 27015);
    expect(result.online).toBe(false);
  });

  it('returns offline result when query times out', async () => {
    mockQuery.mockRejectedValueOnce(new Error('Server is offline or unreachable'));
    const result = await queryServer('1.2.3.4', 27015);
    expect(result.online).toBe(false);
  });
});
