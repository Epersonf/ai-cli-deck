import type { PairingRequest } from '@deck/shared';
import type { ShownCode } from '../domain/network.js';
import { unavailable } from '../domain/errors.js';

/** Requests shown at once; more wait their turn (a flood cannot bury the real one). */
const MAX_OPEN = 3;
const TTL_MS = 3 * 60_000;
const BASE_BACKOFF_MS = 10_000;
const MAX_BACKOFF_MS = 60 * 60_000;

interface Open {
  request: PairingRequest;
  cancel: (() => void)[];
}

/**
 * Codes this deck shows to decks asking to pair. Every request that ended on a wrong code doubles the wait
 * before the next one is accepted, so guessing codes from the network gets nowhere; a pairing resets it.
 */
export class PairingRequests {
  private readonly open = new Map<string, Open>();
  private failures = 0;
  private blockedUntil = 0;

  constructor(
    private readonly now: () => number,
    private readonly newCode: () => string,
    private readonly newId: () => string,
  ) {}

  show(asker: { name: string }): ShownCode {
    const now = this.now();
    this.expire(now);
    if (now < this.blockedUntil || this.open.size >= MAX_OPEN) {
      throw unavailable('Pairing is paused for a moment, try again later');
    }
    const id = this.newId();
    const request = {
      id,
      name: asker.name,
      code: this.newCode(),
      expiresAt: new Date(now + TTL_MS).toISOString(),
    };
    const entry: Open = { request, cancel: [] };
    this.open.set(id, entry);
    return {
      code: request.code,
      onCancel: (listener) => void entry.cancel.push(listener),
      done: (outcome) => {
        this.open.delete(id);
        if (outcome === 'paired') this.failures = 0;
        if (outcome === 'wrong') this.fail();
      },
    };
  }

  list(): PairingRequest[] {
    this.expire(this.now());
    return [...this.open.values()].map((entry) => entry.request);
  }

  refuse(id: string): void {
    const entry = this.open.get(id);
    if (!entry) return;
    this.open.delete(id);
    entry.cancel.forEach((listener) => listener());
  }

  private fail(): void {
    this.failures += 1;
    const wait = Math.min(BASE_BACKOFF_MS * 2 ** (this.failures - 1), MAX_BACKOFF_MS);
    this.blockedUntil = this.now() + wait;
  }

  private expire(now: number): void {
    for (const [id, entry] of this.open) {
      if (Date.parse(entry.request.expiresAt) <= now) this.refuse(id);
    }
  }
}
