import { OTP } from '@deck/shared';

interface Client {
  /** Wrong codes in the current round. */
  failures: number;
  /** How many rounds ended in a lock so far. */
  locks: number;
  lockedUntil: number;
  lastFailure: number;
}

const MINUTE_MS = 60_000;

/**
 * Progressive ban per client: 3 wrong codes end a round and lock the client for 1, then 5, 15 and (from the
 * fourth lock on) 60 minutes. A client with no failure for an hour (counted from the end of a lock) starts over; a right code clears it.
 */
export class OtpThrottle {
  private readonly clients = new Map<string, Client>();

  constructor(private readonly now: () => number) {}

  /** Seconds the client must wait, or 0 when it may try. */
  check(key: string): number {
    this.prune();
    const left = (this.clients.get(key)?.lockedUntil ?? 0) - this.now();
    return left > 0 ? Math.ceil(left / 1000) : 0;
  }

  /** Counts a wrong code: the tries left in this round (0 once it locked) and how long the lock is. */
  fail(key: string): { triesLeft: number; wait: number } {
    this.prune();
    const now = this.now();
    const before: Client = this.clients.get(key) ?? {
      failures: 0,
      locks: 0,
      lockedUntil: 0,
      lastFailure: now,
    };
    const failures = before.failures + 1;
    if (failures < OTP.triesPerRound) {
      this.clients.set(key, { ...before, failures, lastFailure: now });
      return { triesLeft: OTP.triesPerRound - failures, wait: 0 };
    }
    const minutes = OTP.lockMinutes[Math.min(before.locks, OTP.lockMinutes.length - 1)] ?? 60;
    const lockedUntil = now + minutes * MINUTE_MS;
    this.clients.set(key, { failures: 0, locks: before.locks + 1, lockedUntil, lastFailure: now });
    return { triesLeft: 0, wait: minutes * 60 };
  }

  /** A right code: forget the client. */
  succeed(key: string): void {
    this.clients.delete(key);
  }

  private prune(): void {
    const now = this.now();
    for (const [key, entry] of this.clients)
      if (now - Math.max(entry.lockedUntil, entry.lastFailure) >= OTP.forgetMinutes * MINUTE_MS)
        this.clients.delete(key);
  }
}
