import { PREVIEW_TABS_MAX } from '@deck/shared';

type Listener = (sessionId: string, tabs: number[]) => void;

/**
 * Which browser tabs each session has open. The pages themselves live in the deck's Chromium, so every device
 * (the phone, the PC through a pairing) should list the same tabs; this is the one list they all follow.
 */
export class BrowserTabs {
  private readonly byId = new Map<string, number[]>();
  private readonly listeners = new Set<Listener>();

  /** Null while no device has said anything about this session. */
  get(sessionId: string): number[] | null {
    return this.byId.get(sessionId) ?? null;
  }

  set(sessionId: string, tabs: readonly number[]): number[] {
    const clean = [
      ...new Set(tabs.filter((n) => Number.isInteger(n) && n >= 1 && n <= PREVIEW_TABS_MAX)),
    ].sort((a, b) => a - b);
    const before = this.byId.get(sessionId);
    this.byId.set(sessionId, clean);
    if (before?.join() !== clean.join()) for (const l of this.listeners) l(sessionId, clean);
    return clean;
  }

  all(): [string, number[]][] {
    return [...this.byId];
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
