import { TOKEN_HEADER } from '@deck/shared';
import type { Headers } from './tunnelClient.js';

/**
 * Headers that describe one hop or one deck's login, never the request itself: they are dropped when a
 * request crosses to another deck (which adds its own trust instead).
 */
const HOP = new Set([
  'host',
  'connection',
  'keep-alive',
  'upgrade',
  'transfer-encoding',
  'te',
  'trailer',
  'proxy-authorization',
  'proxy-connection',
  'origin',
  'referer',
  'cookie',
  'authorization',
  'accept-encoding',
  'content-length',
  'sec-websocket-key',
  'sec-websocket-version',
  'sec-websocket-extensions',
  TOKEN_HEADER,
]);

/** The headers worth carrying to the other deck (lower-cased, joined when repeated). */
export function forwardHeaders(raw: Record<string, string | string[] | undefined>): Headers {
  const out: Headers = {};
  for (const [name, value] of Object.entries(raw)) {
    const key = name.toLowerCase();
    if (value === undefined || HOP.has(key)) continue;
    out[key] = Array.isArray(value) ? value.join(', ') : value;
  }
  return out;
}

/** Response headers to pass back; the body is re-streamed, so its framing headers are the proxy's. */
export function responseHeaders(raw: Headers): Headers {
  const out: Headers = {};
  for (const [name, value] of Object.entries(raw)) {
    const key = name.toLowerCase();
    if (
      ['connection', 'keep-alive', 'transfer-encoding', 'content-encoding', 'set-cookie'].includes(
        key,
      )
    )
      continue;
    out[key] = value;
  }
  return out;
}
