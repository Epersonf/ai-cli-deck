import { limited } from '../testing/retryHarness.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agentBody, createHarness } from '../testing/harness.js';
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
});
afterEach(() => vi.useRealTimers());
const failed = { t: 'turn-end', error: '429 rate limit', costUsd: null, durationMs: null } as const;

describe('initial requests interrupted before any progress', () => {
  it('does not lose the new task even if an existing thread was initialized before input was accepted', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(agentBody());
    await h.sessions.send(id, 'a new task');
    h.agent.last.sink.chatId('existing-thread');
    h.agent.last.sink.event(failed);
    const retry = (await h.sessions.settings(id)).retry;
    if (!retry) throw new Error('No choice');
    await h.sessions.chooseRetry(id, retry.id, 'now');
    expect(h.agent.last.spec.resumeId).toBe('existing-thread');
    expect(h.agent.last.sent[0]?.text).toBe('a new task');
  });

  it('retries the pending fork with its original first question, leaving the parent untouched', async () => {
    const h = createHarness();
    const source = await h.sessions.create({ ...agentBody(), provider: 'codex' });
    await h.sessions.send(source.id, 'original task');
    h.agent.last.sink.chatId('parent-thread');
    h.agent.last.reply('done');
    h.agent.available = { compact: true, fork: true };
    const fork = await h.chatActions.fork(source.id, {});
    await h.sessions.send(fork.id, 'first question in the fork');
    // Failure before the provider reports the newly forked thread id.
    h.agent.last.sink.event(failed);
    const retry = (await h.sessions.settings(fork.id)).retry;
    if (!retry) throw new Error('No choice');
    expect(retry.threadId).toBeNull();
    await h.sessions.chooseRetry(fork.id, retry.id, 'now');
    expect(h.agent.last.spec).toMatchObject({ resumeId: 'parent-thread', fork: true });
    expect(h.agent.last.sent[0]?.text).toBe('first question in the fork');
    expect(h.sessions.get(source.id)?.meta['chat']).toBe('parent-thread');
  });
  it('does not restore an old authorization after a newer user instruction', async () => {
    const { h, id, state } = await limited();
    await h.sessions.chooseRetry(id, state.id, 'wait');
    await h.sessions.send(id, 'a newer instruction');
    const restored = createHarness({ stored: h.store.saved, log: h.log });
    vi.clearAllTimers();
    await restored.sessions.restore();
    expect((await restored.sessions.settings(id)).retry).toBeNull();
    await vi.advanceTimersByTimeAsync(86_400_000);
    expect(restored.agent.runs).toHaveLength(0);
  });
});
