import { notFound } from '../../domain/errors.js';
import { jsonCall, type DeviceRequest } from '../../infrastructure/peers/deviceCall.js';
import type { Container } from '../container.js';

export type DeviceDeps = Pick<Container, 'network' | 'device'>;

/** Words that mean this deck itself. */
const HERE = new Set(['here', 'this', 'local', 'aqui', 'self']);

const plain = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

export interface Target {
  /** The paired deck's id, or null for this deck. */
  id: string | null;
  name: string;
}

/**
 * Finds a device by what an agent wrote: `here` (this deck), a paired deck's id or name in any case or
 * accents, or a word or the start of a name that only one device fits. Then talks to its API.
 */
export function deviceRouter(deps: DeviceDeps) {
  const target = (name: string): Target => {
    const wanted = plain(name);
    const self = deps.network.status();
    if (HERE.has(wanted) || wanted === plain(self.name) || name === self.id) {
      return { id: null, name: self.name };
    }
    const peers = deps.network.peers();
    const exact = peers.find((p) => p.id === name || plain(p.name) === wanted);
    const close = peers.filter((p) => {
      const full = plain(p.name);
      return full.startsWith(wanted) || full.split(/\s+/).includes(wanted);
    });
    const found = exact ?? (close.length === 1 ? close[0] : undefined);
    if (found) return { id: found.id, name: found.name };
    const known = peers.map((p) => p.name).join(', ') || 'none (pair one in Settings > Devices)';
    throw notFound(`Device "${name}" (use "here" for this one; paired: ${known})`);
  };
  const request = (name: string): DeviceRequest => deps.device(target(name).id);
  return {
    target,
    request,
    call: <T>(name: string, method: string, path: string, body?: unknown): Promise<T> =>
      jsonCall(request(name), method, path, body) as Promise<T>,
  };
}

export type DeviceRouter = ReturnType<typeof deviceRouter>;
