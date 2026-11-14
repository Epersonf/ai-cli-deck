import { limited } from '../testing/retryHarness.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agentBody, createHarness } from '../testing/harness.js';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  vi.spyOn(Math, 'random').mockReturnValue(0);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe('waiting and continuing an interrupted task', () => {
  it.each(['claude', 'codex'])(
    'requires opt-in and resumes the same %s thread without replaying the task',
    async (provider) => {
      const { h, id, state } = await limited(provider);
      expect(state.status).toBe('offered');
      expect(h.agent.last.closed).toBe(true);
      await vi.advanceTimersByTimeAsync(120_000);
      expect(h.agent.runs).toHaveLength(1);
      await h.sessions.chooseRetry(id, state.id, 'wait');
      await vi.advanceTimersByTimeAsync(1500);
      expect(h.agent.runs).toHaveLength(2);
      expect(h.agent.last.spec.resumeId).toBe('saved-thread');
      expect(h.agent.last.sent[0]?.text).toContain('do not repeat completed actions');
      expect((await h.sessions.snapshot(id)).events.filter((e) => e.t === 'user')).toHaveLength(1);
      h.agent.last.reply('done');
      expect((await h.sessions.settings(id)).retry).toBeNull();
      expect(h.sessions.isBusy(id)).toBe(false);
    },
  );

  it('cancels on Stop, ignores stale actions and retains queued requests until the choice is resolved', async () => {
    const { h, id, state } = await limited();
    await h.sessions.sendOrQueue(id, 'next request');
    expect(h.sessions.queued(id)).toHaveLength(1);
    await h.sessions.chooseRetry(id, 'stale-id', 'now');
    expect(h.agent.runs).toHaveLength(1);
    h.sessions.interrupt(id);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(h.agent.last.sent[0]?.text).toBe('next request');
    expect(h.agent.runs).toHaveLength(2);
    await h.sessions.chooseRetry(id, state.id, 'now');
    expect(h.agent.runs).toHaveLength(2);
  });

  it('persists an authorized wait across server restart, with no prompt or attachments in metadata', async () => {
    const { h, id, state } = await limited('codex');
    await h.sessions.chooseRetry(id, state.id, 'wait');
    expect(h.sessions.get(id)?.meta['retry']).not.toContain('complete the task');
    const restored = createHarness({ stored: h.store.saved, log: h.log });
    // Discard the first instance's timer, as happens when its process exits.
    vi.clearAllTimers();
    await restored.sessions.restore();
    expect((await restored.sessions.settings(id)).retry?.status).toBe('waiting');
    expect(restored.agent.runs).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(restored.agent.last.spec.resumeId).toBe('saved-thread');
  });

  it('does not offer a wait for billing, authentication, context or arbitrary task errors', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(agentBody());
    for (const error of [
      '402 Insufficient Balance',
      '401 Unauthorized',
      'context_window_exceeded',
      'Task failed',
    ]) {
      await h.sessions.send(id, 'task');
      h.agent.last.sink.event({ t: 'turn-end', error, costUsd: null, durationMs: null });
      expect((await h.sessions.settings(id)).retry).toBeNull();
      expect(h.sessions.isBusy(id)).toBe(false);
    }
  });
});
