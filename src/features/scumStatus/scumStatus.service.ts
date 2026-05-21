import net from 'net';
import { logger } from '../../utils/logger';

export type QueryResult =
  | { online: true; serverName: string; players: number; maxPlayers: number; ping: number }
  | { online: false };

interface BattleMetricsServer {
  attributes: {
    name: string;
    ip: string;
    port: number;
    players: number;
    maxPlayers: number;
    status: string;
  };
}

function tcpPing(host: string, port: number, timeout = 3000): Promise<number | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.on('connect', () => { resolve(Date.now() - start); socket.destroy(); });
    socket.on('error',   () => { resolve(null); socket.destroy(); });
    socket.on('timeout', () => { resolve(null); socket.destroy(); });
    socket.connect(port, host);
  });
}

export async function queryServer(host: string, port: number): Promise<QueryResult> {
  const url = `https://api.battlemetrics.com/servers?filter[game]=scum&filter[search]=${host}&fields[server]=name,ip,port,players,maxPlayers,status`;

  try {
    const [res, ping] = await Promise.all([
      fetch(url),
      tcpPing(host, port),
    ]);

    if (!res.ok) {
      logger.warn(`[scumStatus] BattleMetrics HTTP ${res.status} für ${host}:${port}`);
      return { online: false };
    }

    const data = (await res.json()) as { data?: BattleMetricsServer[] };
    const servers = data?.data ?? [];
    const match = servers.find(s => s.attributes.ip === host && s.attributes.port === port);

    if (!match || match.attributes.status !== 'online') {
      return { online: false };
    }

    const a = match.attributes;
    return {
      online:     true,
      serverName: a.name,
      players:    a.players,
      maxPlayers: a.maxPlayers,
      ping:       ping ?? 0,
    };
  } catch (err) {
    logger.warn(`[scumStatus] Fehler (${host}:${port}): ${err}`);
    return { online: false };
  }
}
