import type { EventBus } from '../domain/events.js';
import { screenTail } from './screenTail.js';

/** Output this soon after typing is the terminal echoing the keys, not the program working. */
const ECHO_MS = 1500;
/** A terminal that printed within this time is busy. */
const BUSY_MS = 3000;
/** How often the summary line is refreshed while a terminal stays busy. */
const SUMMARY_EVERY_MS = 8000;
const TICK_MS = 2000;
const SUMMARY_CHARS = 140;

export interface Activity {
  sessionId: string;
  /** Printing right now (the agent is working), as opposed to waiting. */
  busy: boolean;
  /** The last line with words on its screen. */
  summary: string;
}

interface State {
  lastInput: number;
  lastOutput: number;
  summaryAt: number;
  busy: boolean;
  summary: string;
}

const decoder = new TextDecoder();

/** Follows what every terminal is doing and tells listeners only when it changes (no one has to ask). */
export class ActivityTracker {
  private readonly states = new Map<string, State>();
  private readonly listeners = new Set<(activity: Activity) => void>();

  constructor(
    private readonly bus: EventBus,
    private readonly replay: (sessionId: string) => Promise<Uint8Array>,
    private readonly now: () => number,
  ) {}

  start(): void {
    this.bus.subscribe((event) => {
      if (event.kind === 'exit') this.states.delete(event.sessionId);
      else if (event.kind === 'input') this.stateOf(event.sessionId).lastInput = this.now();
      else if (event.kind === 'output') {
        const state = this.stateOf(event.sessionId);
        const now = this.now();
        if (now - state.lastInput > ECHO_MS) state.lastOutput = now;
      }
    });
    setInterval(() => void this.tick(), TICK_MS).unref();
  }

  subscribe(listener: (activity: Activity) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** What is known right now, for a device that just connected. */
  snapshot(): Activity[] {
    return [...this.states].map(([sessionId, s]) => ({
      sessionId,
      busy: s.busy,
      summary: s.summary,
    }));
  }

  async tick(now = this.now()): Promise<void> {
    for (const [sessionId, state] of this.states) {
      const busy = state.lastOutput > 0 && now - state.lastOutput < BUSY_MS;
      const refresh = (state.busy && !busy) || (busy && now - state.summaryAt >= SUMMARY_EVERY_MS);
      let summary = state.summary;
      if (refresh) {
        summary = await this.summaryOf(sessionId, state.summary);
        state.summaryAt = now;
      }
      if (busy === state.busy && summary === state.summary) continue;
      state.busy = busy;
      state.summary = summary;
      for (const listener of this.listeners) listener({ sessionId, busy, summary });
    }
  }

  private async summaryOf(sessionId: string, previous: string): Promise<string> {
    try {
      return screenTail(decoder.decode(await this.replay(sessionId)), 1, SUMMARY_CHARS) || previous;
    } catch {
      return previous;
    }
  }

  private stateOf(sessionId: string): State {
    let state = this.states.get(sessionId);
    if (!state) {
      state = { lastInput: 0, lastOutput: 0, summaryAt: 0, busy: false, summary: '' };
      this.states.set(sessionId, state);
    }
    return state;
  }
}
