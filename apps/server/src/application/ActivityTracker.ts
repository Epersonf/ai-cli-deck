import type { ChatEvent } from '@deck/shared';
import type { EventBus } from '../domain/events.js';

const SUMMARY_CHARS = 140;

export interface Activity {
  sessionId: string;
  /** The agent is answering right now, as opposed to waiting for you. */
  busy: boolean;
  /** The last thing it said or did. */
  summary: string;
}

const clip = (text: string): string => text.replace(/\s+/g, ' ').trim().slice(0, SUMMARY_CHARS);

/** What a step says about progress, or null for steps that say nothing. */
function summaryOf(event: ChatEvent): string | null {
  if (event.t === 'text') return clip(event.text);
  if (event.t === 'tool') return clip(event.name);
  if (event.t === 'permission') return clip(`Needs approval: ${event.tool}`);
  if (event.t === 'turn-end' && event.error) return clip(event.error);
  return null;
}

/** Follows what every chat is doing and tells listeners only when it changes (no one has to ask). */
export class ActivityTracker {
  private readonly states = new Map<string, Activity>();
  private readonly listeners = new Set<(activity: Activity) => void>();

  constructor(private readonly bus: EventBus) {}

  start(): void {
    this.bus.subscribe((event) => {
      if (event.kind === 'removed') this.states.delete(event.sessionId);
      else if (event.kind === 'busy') this.set(event.sessionId, { busy: event.busy });
      else if (event.kind === 'chat') {
        const summary = summaryOf(event.event);
        if (summary) this.set(event.sessionId, { summary });
      }
    });
  }

  subscribe(listener: (activity: Activity) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** What is known right now, for a device that just connected. */
  snapshot(): Activity[] {
    return [...this.states.values()];
  }

  private set(sessionId: string, patch: Partial<Activity>): void {
    const before = this.states.get(sessionId) ?? { sessionId, busy: false, summary: '' };
    const next = { ...before, ...patch };
    if (next.busy === before.busy && next.summary === before.summary) return;
    this.states.set(sessionId, next);
    for (const listener of this.listeners) listener(next);
  }
}
