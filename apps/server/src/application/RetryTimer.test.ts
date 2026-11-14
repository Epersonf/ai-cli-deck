import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatRetry } from '@deck/shared';
import { RetryTimer } from './RetryTimer.js';
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
});
afterEach(() => vi.useRealTimers());
const state: ChatRetry = {
  id: 'choice',
  sourceId: 'user',
  threadId: 'thread',
  kind: 'usage',
  status: 'waiting',
  retryAt: '2026-01-01T00:01:00Z',
  estimated: false,
  attempt: 0,
};
describe('durable and cancellable waiting', () => {
  it('does not schedule an operation cancelled while its choice is still saving', async () => {
    let resolve!: () => void;
    const save = () =>
      new Promise<void>((done) => {
        resolve = done;
      });
    const resume = vi.fn();
    const timer = new RetryTimer(save, resume, vi.fn());
    const writing = timer.write(state, true);
    timer.stop();
    resolve();
    expect(await writing).toBe(false);
    await vi.advanceTimersByTimeAsync(86_400_000);
    expect(resume).not.toHaveBeenCalled();
  });
  it('never runs work when persisting the choice fails', async () => {
    const resume = vi.fn();
    const failed = vi.fn();
    const timer = new RetryTimer(() => Promise.reject(new Error('disk full')), resume, failed);
    expect(await timer.write(state, true)).toBe(false);
    await vi.advanceTimersByTimeAsync(86_400_000);
    expect(failed).toHaveBeenCalledOnce();
    expect(resume).not.toHaveBeenCalled();
  });
});
