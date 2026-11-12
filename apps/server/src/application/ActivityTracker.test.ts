import { describe, expect, it } from 'vitest';
import { EventBus } from '../domain/events.js';
import { ActivityTracker, type Activity } from './ActivityTracker.js';

function setup() {
  const bus = new EventBus();
  const tracker = new ActivityTracker(bus);
  const seen: Activity[] = [];
  tracker.subscribe((a) => seen.push(a));
  tracker.start();
  return { bus, tracker, seen };
}

describe('ActivityTracker', () => {
  it('is busy while an answer is being written, with the last thing said', () => {
    const { bus, seen } = setup();
    bus.publish({ kind: 'busy', sessionId: 's1', busy: true });
    bus.publish({
      kind: 'chat',
      sessionId: 's1',
      event: { t: 'text', id: 'a', text: 'Looking at\nthe code' },
    });
    expect(seen.at(-1)).toEqual({ sessionId: 's1', busy: true, summary: 'Looking at the code' });
    bus.publish({ kind: 'busy', sessionId: 's1', busy: false });
    expect(seen.at(-1)).toMatchObject({ busy: false });
  });

  it('tells listeners only about changes, and forgets removed sessions', () => {
    const { bus, tracker, seen } = setup();
    bus.publish({ kind: 'busy', sessionId: 's1', busy: false });
    expect(seen).toEqual([]);
    bus.publish({ kind: 'busy', sessionId: 's1', busy: true });
    bus.publish({ kind: 'busy', sessionId: 's1', busy: true });
    expect(seen).toHaveLength(1);
    expect(tracker.snapshot()).toHaveLength(1);
    bus.publish({ kind: 'removed', sessionId: 's1' });
    expect(tracker.snapshot()).toEqual([]);
  });

  it('shows a request for approval as the summary', () => {
    const { bus, seen } = setup();
    bus.publish({
      kind: 'chat',
      sessionId: 's1',
      event: { t: 'permission', id: 'p', tool: 'Bash', input: {}, canAlways: false, reason: null },
    });
    expect(seen.at(-1)?.summary).toBe('Needs approval: Bash');
  });
});
