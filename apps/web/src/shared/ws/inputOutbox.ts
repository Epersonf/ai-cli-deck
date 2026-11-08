export interface PendingInput {
  seq: number;
  at: number;
  data: string;
}

/**
 * Typed input waits here until the server confirms it. A link that died without saying so swallows what
 * was sent into it; after the reconnect the unconfirmed input goes again (the server applies each number once).
 */
export function createOutbox(maxAgeMs: number, now: () => number = Date.now) {
  let seq = 0;
  let items: PendingInput[] = [];
  return {
    add(data: string): number {
      seq += 1;
      items.push({ seq, at: now(), data });
      return seq;
    },
    ack(upTo: number): void {
      items = items.filter((item) => item.seq > upTo);
    },
    /** Still worth sending: input older than `maxAgeMs` would surprise the user, so it is dropped. */
    pending(): PendingInput[] {
      items = items.filter((item) => now() - item.at <= maxAgeMs);
      return [...items];
    },
  };
}
