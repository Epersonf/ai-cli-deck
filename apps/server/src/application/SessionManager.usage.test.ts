import { describe, expect, it } from 'vitest';
import { agentBody, createHarness } from '../testing/harness.js';

describe('chat usage', () => {
  it('adds up cost over runs, keeps the context, and announces what changed', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(agentBody());
    expect(h.sessions.usage(id)).toMatchObject({ costUsd: null, contextTokens: null });
    await h.sessions.send(id, 'hi');
    h.events.length = 0;
    h.agent.last.sink.usage({ contextTokens: 12_000 });
    h.agent.last.sink.usage({ costUsd: 0.2, contextWindow: 200_000 });
    h.agent.last.reply('ok');
    expect(h.sessions.usage(id)).toMatchObject({
      costUsd: 0.2,
      contextTokens: 12_000,
      contextWindow: 200_000,
    });
    expect(h.events.filter((e) => e.kind === 'usage')).toHaveLength(2);
    h.agent.last.sink.ended();
    await h.sessions.send(id, 'again');
    h.agent.last.sink.usage({ costUsd: 0.1 });
    expect(h.sessions.usage(id).costUsd).toBeCloseTo(0.3);
  });

  it('does not announce a reading that changes nothing', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(agentBody());
    await h.sessions.send(id, 'hi');
    h.agent.last.sink.usage({ contextTokens: 5 });
    h.events.length = 0;
    h.agent.last.sink.usage({ contextTokens: 5 });
    expect(h.events).toEqual([]);
  });

  it('shares the account limit between the sessions of one profile and tells them all', async () => {
    const h = createHarness();
    const a = await h.sessions.create(agentBody());
    const b = await h.sessions.create(agentBody());
    const other = await h.sessions.create({ ...agentBody(), provider: 'codex' });
    await h.sessions.send(a.id, 'hi');
    h.events.length = 0;
    const resetsAt = new Date(Date.now() + 3_600_000).toISOString();
    h.agent.last.sink.usage({
      limit: { key: 'five_hour', used: 0.42, resetsAt, label: '5-hour limit' },
    });
    h.agent.last.sink.usage({
      limit: { key: 'seven_day', used: 0.1, resetsAt, label: 'Weekly limit' },
    });
    expect(h.sessions.usage(b.id).limits).toEqual([
      { key: 'five_hour', used: 0.42, resetsAt, label: '5-hour limit' },
      { key: 'seven_day', used: 0.1, resetsAt, label: 'Weekly limit' },
    ]);
    expect(h.sessions.usage(other.id).limits).toEqual([]);
    const told = h.events.flatMap((e) => (e.kind === 'usage' ? [e.sessionId] : []));
    expect([...new Set(told)].sort()).toEqual([a.id, b.id].sort());
  });

  it('forgets a limit once its window has reset', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(agentBody());
    h.limits.set('claude', {
      key: 'five_hour',
      used: 0.9,
      resetsAt: new Date(Date.now() - 1000).toISOString(),
      label: null,
    });
    expect(h.sessions.usage(id).limits).toEqual([]);
  });

  it('keeps the cache of the last answer, and its lifetime across answers that only read', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(agentBody());
    await h.sessions.send(id, 'hi');
    h.agent.last.sink.usage({
      contextTokens: 1000,
      cache: { read: 0, write: 900, ttlMs: 3_600_000 },
    });
    h.agent.last.sink.usage({ contextTokens: 1100, cache: { read: 900, write: 100, ttlMs: null } });
    expect(h.sessions.usage(id).cache).toMatchObject({ read: 900, write: 100, ttlMs: 3_600_000 });
  });

  it('empties the context and the cache when the chat is compacted', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(agentBody());
    await h.sessions.send(id, 'hi');
    h.agent.last.sink.usage({
      contextTokens: 150_000,
      cache: { read: 1, write: 1, ttlMs: 300_000 },
    });
    h.agent.last.sink.usage({ compacted: true });
    expect(h.sessions.usage(id)).toMatchObject({ contextTokens: null, cache: null });
    h.agent.last.sink.usage({ compacted: true, contextTokens: 9000 });
    expect(h.sessions.usage(id).contextTokens).toBe(9000);
  });
});

describe('background tasks', () => {
  it('stops a task through the live run, and ignores the stop when there is no run', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(agentBody());
    h.sessions.stopTask(id, 't1');
    await h.sessions.send(id, 'hi');
    h.agent.last.sink.event({ t: 'task', id: 't1', title: 'npm run dev', state: 'running' });
    h.sessions.stopTask(id, 't1');
    expect(h.agent.last.stopped).toEqual(['t1']);
  });

  it('marks tasks that were running when the server stopped as stopped, after a restart', async () => {
    const first = createHarness();
    const { id } = await first.sessions.create(agentBody());
    await first.sessions.send(id, 'serve');
    first.agent.last.sink.event({ t: 'task', id: 't1', title: 'npm run dev', state: 'running' });
    first.agent.last.reply('started');
    await first.sessions.snapshot(id);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = createHarness({ log: first.log, stored: first.store.saved });
    await second.sessions.restore();
    const events = (await second.sessions.snapshot(id)).events;
    expect(events.at(-1)).toMatchObject({ t: 'task', id: 't1', state: 'stopped' });
  });
});
