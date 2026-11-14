import { createHash } from 'node:crypto';
import type { Session } from '@deck/shared';
import type { BriefingSnapshot, BriefingStore } from './BriefingStore.js';

/** Exact, private prefix snapshots, scoped to the session and profile. */
export class BriefingBook {
  private readonly snapshots = new Map<string, BriefingSnapshot>();
  constructor(private readonly store?: BriefingStore) {}

  get(session: Session, fresh: boolean, build: () => string): string {
    const kept = this.snapshots.get(session.id) ?? this.store?.read(session.id);
    if (kept && kept.provider === session.provider && !fresh) {
      this.snapshots.set(session.id, kept);
      return kept.guide;
    }
    const guide = build();
    this.keep(session, guide);
    return guide;
  }

  keep(session: Session, guide: string): void {
    const snapshot: BriefingSnapshot = {
      version: 1,
      provider: session.provider,
      guide,
      hash: createHash('sha256').update(guide).digest('hex'),
    };
    this.store?.write(session.id, snapshot);
    this.snapshots.set(session.id, snapshot);
  }

  forget(id: string): void {
    this.snapshots.delete(id);
    this.store?.remove(id);
  }
}
