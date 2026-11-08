import { describe, expect, it } from 'vitest';
import { EventBus } from '../domain/events';
import { ActivityTracker, type Activity } from './ActivityTracker';

function setup(screen = 'Reading files\r\nrunning tests') {
  const clock = 10_000;
  const bus = new EventBus();
  const seen: Activity[] = [];
  const tracker = new ActivityTracker(
    bus,
    () => Promise.resolve(new TextEncoder().encode(screen)),
    () => clock,
  );
  tracker.start();
  tracker.subscribe((a) => seen.push(a));
  const output = () => bus.publish({ kind: 'output', sessionId: 's', data: new Uint8Array([65]) });
  return { bus, seen, tracker, output };
}

describe('ActivityTracker', () => {
  it('is busy while output flows, then quiet with the last line as summary', async () => {
    const { seen, tracker, output } = setup();
    output();
    await tracker.tick(10_500);
    expect(seen.at(-1)).toMatchObject({ busy: true });
    await tracker.tick(14_000);
    expect(seen.at(-1)).toEqual({ sessionId: 's', busy: false, summary: 'running tests' });
  });

  it('does not repeat itself while nothing changes', async () => {
    const { seen, tracker, output } = setup();
    output();
    await tracker.tick(10_500);
    const count = seen.length;
    await tracker.tick(11_000);
    expect(seen.length).toBe(count);
  });

  it('ignores the echo of what was just typed', async () => {
    const { bus, seen, tracker, output } = setup();
    bus.publish({ kind: 'input', sessionId: 's' });
    output();
    await tracker.tick(10_500);
    expect(seen).toHaveLength(0);
  });
});
