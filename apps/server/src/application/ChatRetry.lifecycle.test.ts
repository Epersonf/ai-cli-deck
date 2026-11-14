import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agentBody, createHarness } from '../testing/harness.js';
import { limited } from '../testing/retryHarness.js';
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  vi.spyOn(Math, 'random').mockReturnValue(0);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const failure = {
  t: 'turn-end',
  error: '429 rate limit exceeded',
  costUsd: null,
  durationMs: null,
} as const;

describe('automatic continuation lifecycle', () => {
  it('backs off after repeated limits and asks again after five attempts', async () => {
    const { h, id, state } = await limited();
    await h.sessions.chooseRetry(id, state.id, 'wait');
    for (let attempt = 1; attempt <= 5; attempt++) {
      const pending = (await h.sessions.settings(id)).retry;
      if (!pending) throw new Error('No wait scheduled');
      await vi.advanceTimersByTimeAsync(Date.parse(pending.retryAt) - Date.now());
      expect(h.agent.runs).toHaveLength(attempt + 1);
      h.agent.last.sink.event(failure);
    }
    expect((await h.sessions.settings(id)).retry).toMatchObject({ status: 'offered', attempt: 5 });
    await vi.advanceTimersByTimeAsync(86_400_000);
    expect(h.agent.runs).toHaveLength(6);
  });

  it('does not allow duplicate/stale requests or events from the replaced run to end a resumed turn', async () => {
    const { h, id, state } = await limited('codex');
    const old = h.agent.last;
    await Promise.all([
      h.sessions.chooseRetry(id, state.id, 'now'),
      h.sessions.chooseRetry(id, state.id, 'now'),
    ]);
    expect(h.agent.runs).toHaveLength(2);
    old.sink.event({ t: 'turn-end', error: null, costUsd: null, durationMs: null });
    old.sink.ended();
    old.sink.usage({ contextTokens: 999_999 });
    expect(h.sessions.isBusy(id)).toBe(true);
    expect(h.sessions.usage(id).contextTokens).not.toBe(999_999);
  });

  it('restores an unapproved offer without authorizing any work', async () => {
    const { h, id } = await limited();
    const restored = createHarness({ stored: h.store.saved, log: h.log });
    await restored.sessions.restore();
    expect((await restored.sessions.settings(id)).retry?.status).toBe('offered');
    await vi.advanceTimersByTimeAsync(86_400_000);
    expect(restored.agent.runs).toHaveLength(0);
  });

  it('resends an unaccepted initial request, but never persists or loses attachments silently', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(agentBody());
    await h.sessions.send(id, 'use the attached image', [{ mediaType: 'image/png', data: 'AAAA' }]);
    h.agent.last.sink.event(failure);
    const state = (await h.sessions.settings(id)).retry;
    if (!state) throw new Error('No choice');
    await h.sessions.chooseRetry(id, state.id, 'wait');
    const saved = h.store.saved;
    expect(JSON.stringify(saved)).not.toContain('AAAA');
    vi.clearAllTimers();
    const restored = createHarness({ stored: saved, log: h.log });
    await restored.sessions.restore();
    expect((await restored.sessions.settings(id)).retry).toBeNull();
    await vi.advanceTimersByTimeAsync(86_400_000);
    expect(restored.agent.runs).toHaveLength(0);
    await h.sessions.chooseRetry(id, state.id, 'now');
    expect(h.agent.last.sent[0]).toMatchObject({
      text: 'use the attached image',
      images: [{ data: 'AAAA' }],
    });
  });

  it('cancels a saved wait when starting a new conversation or changing profiles', async () => {
    const { h, id, state } = await limited();
    await h.sessions.chooseRetry(id, state.id, 'wait');
    await h.sessions.clear(id);
    await vi.advanceTimersByTimeAsync(86_400_000);
    expect(h.agent.runs).toHaveLength(1);
    expect(h.sessions.get(id)?.meta['retry']).toBeUndefined();
    expect((await h.sessions.settings(id)).retry).toBeNull();
  });
});
