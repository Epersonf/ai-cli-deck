import { randomUUID } from 'node:crypto';

const TTL_MS = 6 * 60 * 60_000;

/**
 * The secret address behind a notification's Reply box. One per chat, reused while it is fresh, so replying from an
 * old notification still works; it leads to that chat only, and only the phone bridge (never an agent) is given it.
 */
export class ReplyLinks {
  private readonly byToken = new Map<string, { sessionId: string; expiresAt: number }>();
  private readonly bySession = new Map<string, string>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly ttlMs: number = TTL_MS,
  ) {}

  issue(sessionId: string): string {
    const known = this.bySession.get(sessionId);
    const token = known && this.resolve(known) !== null ? known : randomUUID();
    this.byToken.set(token, { sessionId, expiresAt: this.now() + this.ttlMs });
    this.bySession.set(sessionId, token);
    return token;
  }

  /** The chat behind the address; null when it is unknown or too old. */
  resolve(token: string): string | null {
    const item = this.byToken.get(token);
    if (!item) return null;
    if (item.expiresAt < this.now()) {
      this.byToken.delete(token);
      if (this.bySession.get(item.sessionId) === token) this.bySession.delete(item.sessionId);
      return null;
    }
    return item.sessionId;
  }
}
