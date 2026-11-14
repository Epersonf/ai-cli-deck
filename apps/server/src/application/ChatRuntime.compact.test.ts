import { describe, expect, it } from 'vitest';
import { agentBody, createHarness } from '../testing/harness.js';

async function setup() {
  const h = createHarness();
  h.agent.available = { compact: true, fork: true };
  const { id } = await h.sessions.create({ ...agentBody(), provider: 'codex' });
  await h.sessions.send(id, 'hello');
  h.agent.last.sink.chatId('codex-thread');
  h.agent.last.reply('hello');
  return { h, id };
}

describe('manual compaction in the chat', () => {
  it('compacts Codex natively, clears stale context and does not add a /compact prompt', async () => {
    const { h, id } = await setup();
    h.agent.last.sink.usage({
      contextTokens: 100_000,
      cache: { read: 90_000, write: null, uncached: 10_000, ttlMs: null },
    });
    await h.sessions.compact(id);
    expect(h.agent.compactions[0]?.spec).toMatchObject({ kind: 'codex', resumeId: 'codex-thread' });
    expect(h.agent.runs).toHaveLength(1);
    expect((await h.sessions.snapshot(id)).events.filter((e) => e.t === 'user')).toHaveLength(1);
    expect(h.sessions.usage(id)).toMatchObject({ contextTokens: null, cache: null });
    expect(h.sessions.isBusy(id)).toBe(false);
  });

  it('blocks duplicate compactions, holds queued messages, and supports interrupt', async () => {
    const { h, id } = await setup();
    let began!: () => void;
    const started = new Promise<void>((resolve) => {
      began = resolve;
    });
    h.agent.compactResult = (signal) =>
      new Promise((_, reject) => {
        began();
        signal.addEventListener('abort', () => reject(new Error('Compaction cancelled')), {
          once: true,
        });
      });
    const pending = h.sessions.compact(id);
    await started;
    expect((await h.sessions.snapshot(id)).config.compacting).toBe(true);
    await expect(h.sessions.compact(id)).rejects.toThrow('current answer');
    await h.sessions.sendOrQueue(id, 'after compaction');
    expect(h.sessions.queued(id)).toHaveLength(1);
    h.sessions.interrupt(id);
    await pending;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.agent.last.sent[0]?.text).toBe('after compaction');
    expect((await h.sessions.snapshot(id)).config.compacting).toBe(false);
  });

  it('preserves Claude SDK /compact behavior and provider settings', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(agentBody());
    await h.sessions.send(id, 'hello');
    h.agent.last.sink.chatId('claude-thread');
    h.agent.last.reply('hello');
    await h.sessions.compact(id);
    expect(h.agent.last.sent.at(-1)?.text).toBe('/compact');
    expect(h.agent.compactions).toEqual([]);
    expect(h.agent.last.spec.kind).toBe('claude');
  });

  it('rejects unsupported agents and chats without a thread, including typed /compact', async () => {
    const { h, id } = await setup();
    h.agent.available = { compact: false, fork: false };
    const other = await h.sessions.create({ ...agentBody(), provider: 'codex' });
    await expect(h.sessions.send(other.id, '/compact')).rejects.toThrow('before compacting');
    await h.sessions.send(other.id, 'hello');
    h.agent.last.sink.chatId('other-thread');
    h.agent.last.reply('hi');
    await expect(h.sessions.compact(other.id)).rejects.toThrow('does not support');
    expect(h.sessions.get(id)?.provider).toBe('codex');
  });
});
