import { GameDig } from 'gamedig';
import { logger } from '../../utils/logger';

export type QueryResult =
  | { online: true; serverName: string; players: number; maxPlayers: number; ping: number }
  | { online: false };

export async function queryServer(host: string, port: number): Promise<QueryResult> {
  try {
    const state = await GameDig.query({
      type: 'valve',  // SCUM verwendet Steam/Valve A2S-Protokoll ('scum' nicht in gamedig v5)
      host,
      port,
    });
    return {
      online:     true,
      serverName: state.name,
      players:    state.players.length,
      maxPlayers: state.maxplayers,
      ping:       state.ping,
    };
  } catch (err) {
    logger.warn(`[scumStatus] Query fehlgeschlagen (${host}:${port}): ${err}`);
    return { online: false };
  }
}
