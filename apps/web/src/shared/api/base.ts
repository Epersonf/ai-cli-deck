import { PEER_PATH } from '@deck/shared';

const match = new RegExp(`^${PEER_PATH}/([^/]+)/`).exec(window.location.pathname);

/**
 * Set when this page is a paired deck's app, shown through this deck at `/peer/<id>/`: every request and
 * socket then goes to that deck (this deck carries it over the encrypted link).
 */
export const PEER_ID: string | null = match?.[1] ? decodeURIComponent(match[1]) : null;

/** Prefix for this app's API and sockets: empty on this deck, `/peer/<id>` on a paired one. */
export const API_BASE = PEER_ID ? `${PEER_PATH}/${encodeURIComponent(PEER_ID)}` : '';

/** A WebSocket URL for `path` on the deck this page shows. */
export function socketUrl(path: string): string {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}${API_BASE}${path}`;
}
