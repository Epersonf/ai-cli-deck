import { createHash, timingSafeEqual } from 'node:crypto';

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

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

export function tokensMatch(expected: string, provided: string | undefined): boolean {
  if (provided === undefined) return false;
  return timingSafeEqual(digest(expected), digest(provided));
}
