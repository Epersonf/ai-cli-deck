import type { ExecResult, PeerInfo, ProviderInfo, ScreenText, Session } from '@deck/shared';
import { notFound } from '../../domain/errors.js';
import type { Container } from '../container.js';

export type DeviceDeps = Pick<Container, 'network' | 'peerCall'>;

const plain = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

const enc = encodeURIComponent;

/**
 * What an agent can do on the decks this one is paired with (the user's PC from the phone, and back):
 * run a command and wait for it, or use that machine's terminals, including talking to an agent there.
 */
export function createDeviceTools(deps: DeviceDeps) {
  /** A paired deck by id or name (any case or accents), or by a word or the start of a name that only one fits. */
  const device = (name: string): PeerInfo => {
    const peers = deps.network.peers();
    const wanted = plain(name);
    const exact = peers.find((p) => p.id === name || plain(p.name) === wanted);
    const close = peers.filter((p) => {
      const full = plain(p.name);
      return full.startsWith(wanted) || full.split(/\s+/).includes(wanted);
    });
    const found = exact ?? (close.length === 1 ? close[0] : undefined);
    if (found) return found;
    const known = peers.map((p) => p.name).join(', ') || 'none (pair one in Settings > Devices)';
    throw notFound(`Paired device "${name}" (paired: ${known})`);
  };
  const call = <T>(name: string, method: string, path: string, body?: unknown): Promise<T> =>
    deps.peerCall(device(name).id, method, path, body) as Promise<T>;

  return {
    devices: () =>
      deps.network
        .peers()
        .map(({ name, id, online, lastSeen }) => ({ name, id, online, lastSeen })),

    run: (name: string, command: string, cwd?: string, timeoutSec?: number) =>
      call<ExecResult>(name, 'POST', '/api/exec', { command, cwd, timeoutSec }),

    /** Its terminals, and the profiles a new one can start with. */
    terminals: async (name: string) => {
      const [sessions, providers] = await Promise.all([
        call<Session[]>(name, 'GET', '/api/sessions'),
        call<ProviderInfo[]>(name, 'GET', '/api/providers'),
      ]);
      return {
        terminals: sessions.map((s) => ({
          id: s.id,
          title: s.name,
          profile: s.provider,
          cwd: s.cwd,
          status: s.status,
        })),
        profiles: providers
          .filter((p) => p.status !== 'missing')
          .map((p) => ({ id: p.id, label: p.label })),
      };
    },

    /** Starts a terminal there (a profile's agent, or a plain shell with `command`). */
    open: async (name: string, profile: string, cwd?: string, command?: string) => {
      const body = {
        provider: profile,
        cwd: cwd ?? '~',
        useWorktree: false,
        command: command ?? null,
        args: [],
      };
      const session = await call<Session>(name, 'POST', '/api/sessions', body);
      return { terminal: session.id, profile: session.provider, cwd: session.cwd };
    },

    /** Types into one of its terminals (an agent's chat box, a shell), Enter after by default. */
    send: async (name: string, terminal: string, text: string, enter = true) => {
      await call(name, 'POST', `/api/sessions/${enc(terminal)}/input`, { text, enter });
      return { sent: true };
    },

    /** One of its terminals as text, as a person would see it. */
    read: (name: string, terminal: string, lines = 60) =>
      call<ScreenText>(name, 'GET', `/api/sessions/${enc(terminal)}/screen?lines=${lines}`),

    close: async (name: string, terminal: string) => {
      await call(name, 'DELETE', `/api/sessions/${enc(terminal)}`);
      return { closed: true };
    },
  };
}

export type DeviceTools = ReturnType<typeof createDeviceTools>;
