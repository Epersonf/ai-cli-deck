import { describe, expect, it } from 'vitest';
import { agentBody, createHarness } from '../testing/harness.js';

async function talked(provider = 'claude') {
  const h = createHarness();
  const { id } = await h.sessions.create({ ...agentBody(), provider });
  await h.sessions.send(id, 'fix the login bug');
  h.agent.last.sink.chatId('abc-123');
  h.sessions.configure(id, { model: 'opus', mode: 'plan', effort: 'high' });
  h.agent.last.reply('Fixed.');
  return { h, id };
}

describe('a side chat', () => {
  it('forks the saved Claude chat natively, under the same main session, with its settings', async () => {
    const { h, id } = await talked();
    const side = await h.chatActions.side(id);
    expect(side).toMatchObject({ parentId: id, provider: 'claude', cwd: '/work' });
    expect(side.meta).toMatchObject({ model: 'opus', mode: 'plan', effort: 'high' });
    await h.sessions.send(side.id, 'quick question');
    expect(h.agent.last.spec).toMatchObject({
      resumeId: 'abc-123',
      fork: true,
      model: 'opus',
      mode: 'plan',
    });
    const shown = (await h.sessions.snapshot(side.id)).events.filter((e) => e.t === 'user');
    expect(shown).toHaveLength(2);
  });

  it('is one level deep: a side chat of a side chat belongs to the main session', async () => {
    const { h, id } = await talked();
    const side = await h.chatActions.side(id);
    const again = await h.chatActions.side(side.id);
    expect(again.parentId).toBe(id);
  });

  it('is removed with its main session', async () => {
    const { h, id } = await talked();
    const side = await h.chatActions.side(id);
    await h.sessions.remove(id);
    expect(h.sessions.get(side.id)).toBeUndefined();
  });

  it('hands the conversation over as a transcript for an agent that cannot fork', async () => {
    const { h, id } = await talked('codex');
    const side = await h.chatActions.side(id);
    expect(side.parentId).toBe(id);
    expect(h.agent.last.sent.at(-1)?.text).toMatch(/^\[deck\] This chat continues/);
    expect(h.agent.last.spec).toMatchObject({ kind: 'codex', resumeId: null });
  });

  it('is simply empty when the conversation has not started', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(agentBody());
    const side = await h.chatActions.side(id);
    expect(side.parentId).toBe(id);
    expect((await h.sessions.snapshot(side.id)).events).toEqual([]);
    expect(h.agent.runs).toHaveLength(0);
  });
});
