import { DeckError, forbidden, unavailable } from '../../domain/errors.js';
import type { PhonePort } from '../../domain/ports.js';

const TIMEOUT_MS = 8000;

/** The Android app's loopback bridge. The token never leaves this process (sessions do not get it). */
export class HttpPhoneBridge implements PhonePort {
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  async request(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${this.url}${path}`, {
        method,
        headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw unavailable('The phone did not answer (is the Android app running?)');
    }
    const payload = (await response.json().catch(() => ({}))) as { error?: unknown };
    if (response.ok) return payload;
    const message =
      typeof payload.error === 'string' ? payload.error : `phone error ${response.status}`;
    throw response.status === 403 ? forbidden(message) : new DeckError('conflict', message);
  }
}

/** Reads the bridge address and token the app passed in the environment, and removes them from it. */
export function phoneFromEnv(env: NodeJS.ProcessEnv): PhonePort | null {
  const url = env['DECK_PHONE_URL'];
  const token = env['DECK_PHONE_TOKEN'];
  delete env['DECK_PHONE_URL'];
  delete env['DECK_PHONE_TOKEN'];
  return url && token ? new HttpPhoneBridge(url, token) : null;
}
