/** Private snapshots: persisted separately from session metadata and never sent to the browser. */
export interface BriefingSnapshot {
  version: 1;
  provider: string;
  guide: string;
  hash: string;
}

export interface BriefingStore {
  read(sessionId: string): BriefingSnapshot | null;
  write(sessionId: string, snapshot: BriefingSnapshot): void;
  remove(sessionId: string): void;
}
