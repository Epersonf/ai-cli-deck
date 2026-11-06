import { createSocket, type Socket } from 'node:dgram';
import { networkInterfaces } from 'node:os';
import { DISCOVERY_PORT } from '@deck/shared';

const QUERY = 'clideck?';
const ANSWER = 'clideck';
const WAIT_MS = 1200;

export interface Beacon {
  id: string;
  name: string;
  /** The TCP port it accepts pairing and links on. */
  port: number;
}

export interface Found extends Beacon {
  /** `ip:port` to reach it. */
  address: string;
}

const parse = (data: Buffer): Record<string, unknown> | null => {
  try {
    const value: unknown = JSON.parse(data.toString('utf8'));
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

/** Where a "who is there?" goes: everyone on this link, and each interface's own broadcast address. */
export function broadcastTargets(interfaces = networkInterfaces()): string[] {
  const targets = new Set(['255.255.255.255']);
  for (const list of Object.values(interfaces)) {
    for (const nic of list ?? []) {
      if (nic.family !== 'IPv4' || nic.internal) continue;
      const ip = nic.address.split('.').map(Number);
      const mask = nic.netmask.split('.').map(Number);
      targets.add(ip.map((part, i) => (part | (~(mask[i] ?? 0) & 255)) >>> 0).join('.'));
    }
  }
  return [...targets];
}

/** Answers queries while this deck shares itself. Several decks on one machine can all answer. */
export function answerQueries(
  beacon: () => Beacon,
  port = DISCOVERY_PORT,
): Promise<{ close(): void; port: number }> {
  const socket: Socket = createSocket({ type: 'udp4', reuseAddr: true });
  socket.on('message', (data, from) => {
    const query = parse(data);
    if (query?.t !== QUERY) return;
    const answer = Buffer.from(JSON.stringify({ t: ANSWER, v: 1, ...beacon() }));
    socket.send(answer, from.port, from.address);
  });
  return new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.bind(port, () => {
      socket.off('error', reject);
      socket.on('error', () => undefined); // a bad packet must not take the deck down
      resolve({ close: () => socket.close(), port: socket.address().port });
    });
  });
}

export interface DiscoverOptions {
  targets?: string[] | undefined;
  port?: number | undefined;
  waitMs?: number | undefined;
}

/** Asks the network who is sharing and collects the answers for a moment. */
export function discover(options: DiscoverOptions = {}): Promise<Found[]> {
  const port = options.port ?? DISCOVERY_PORT;
  const found = new Map<string, Found>();
  const socket = createSocket('udp4');
  return new Promise((resolve) => {
    const finish = (): void => {
      socket.close();
      resolve([...found.values()]);
    };
    socket.on('error', finish);
    socket.on('message', (data, from) => {
      const answer = parse(data);
      if (answer?.t !== ANSWER || typeof answer.id !== 'string' || typeof answer.port !== 'number')
        return;
      const name = typeof answer.name === 'string' ? answer.name.slice(0, 60) : 'deck';
      found.set(answer.id, {
        id: answer.id,
        name,
        port: answer.port,
        address: `${from.address}:${answer.port}`,
      });
    });
    socket.bind(0, () => {
      socket.setBroadcast(true);
      const query = Buffer.from(JSON.stringify({ t: QUERY, v: 1 }));
      for (const target of options.targets ?? [...broadcastTargets(), '127.0.0.1']) {
        socket.send(query, port, target, () => undefined);
      }
      setTimeout(finish, options.waitMs ?? WAIT_MS);
    });
  });
}
