import { safeEqual } from '../../domain/safeEqual.js';

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function hostnameOf(hostHeader: string | undefined): string {
  if (!hostHeader) return '';
  if (hostHeader.startsWith('[')) return hostHeader.slice(0, hostHeader.indexOf(']') + 1);
  return hostHeader.split(':')[0] ?? '';
}

export const isLoopbackAddress = (address: string): boolean => LOOPBACK_ADDRESSES.has(address);
export const isLoopbackHostname = (hostname: string): boolean => LOOPBACK_HOSTNAMES.has(hostname);

/** Browsers always send Origin on cross-origin and WebSocket requests; it must match Host. */
export function isAllowedOrigin(
  origin: string | undefined,
  hostHeader: string | undefined,
  allowed: readonly string[],
): boolean {
  if (origin === undefined) return true;
  if (allowed.includes(origin)) return true;
  try {
    return new URL(origin).host === hostHeader;
  } catch {
    return false;
  }
}

/** On a loopback bind, only loopback Host headers are served (blocks DNS rebinding). */
export function isAllowedHost(hostHeader: string | undefined, bindIsLoopback: boolean): boolean {
  return !bindIsLoopback || isLoopbackHostname(hostnameOf(hostHeader));
}

const FORWARDED = ['x-forwarded-for', 'forwarded', 'x-real-ip', 'cf-connecting-ip'];

/**
 * True for a request that comes from this machine itself: the real socket address is loopback (never a header the
 * client could write), and nothing says a proxy or tunnel passed it on, since that proxy sits on this machine too.
 */
export function isLocalClient(request: {
  socket: { remoteAddress?: string | undefined };
  headers: Record<string, unknown>;
}): boolean {
  const address = request.socket.remoteAddress ?? '';
  return isLoopbackAddress(address) && !FORWARDED.some((h) => request.headers[h] !== undefined);
}

/** The address of the client as the socket saw it (one key per machine, for bans). */
export const clientKey = (request: { socket: { remoteAddress?: string | undefined } }): string =>
  (request.socket.remoteAddress ?? 'unknown').replace(/^::ffff:/, '');

export function tokensMatch(expected: string, provided: string | undefined): boolean {
  return provided !== undefined && safeEqual(expected, provided);
}
