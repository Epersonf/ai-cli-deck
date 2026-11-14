import { describe, expect, it } from 'vitest';
import { sink } from '../infrastructure/agents/fakeClaude.js';
import { guardedSink } from './guardedSink.js';

describe('callbacks from a limited/replaced run', () => {
  it('allows terminal cleanup of distinct task/permission ids without ending the resumed turn', () => {
    const { s, events, usage, ended } = sink();
    const out = guardedSink(
      s,
      () => false,
      () => true,
    );
    out.event({ t: 'task', id: 'old-task', title: 'Old job', state: 'stopped' });
    out.event({ t: 'permission-done', id: 'old-permission', allowed: false });
    out.event({ t: 'task', id: 'old-task', title: 'Old job', state: 'running' });
    out.event({ t: 'text', id: 'old-text', text: 'late' });
    out.event({ t: 'turn-end', error: null, costUsd: null, durationMs: null });
    out.usage({ contextTokens: 999_999 });
    out.ended();
    expect(events.map((event) => event.t)).toEqual(['task', 'permission-done']);
    expect(usage).toEqual([]);
    expect(ended()).toBe(0);
  });
});
