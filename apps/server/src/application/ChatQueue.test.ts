import type { DeckEvent } from '../domain/events.js';
import { describe, expect, it } from 'vitest';
import { agentBody, createHarness } from '../testing/harness.js';

type Queue = Extract<DeckEvent, { kind: 'queue' }>;

async function setup() {
  const h = createHarness();
  const { id } = await h.sessions.create(agentBody());
  const lists = () =>
    h.events.filter((e): e is Queue => e.kind === 'queue').map((e) => e.items.map((i) => i.text));
  await h.sessions.send(id, 'first');
  return { h, id, lists };
}
const settle = () => new Promise((r) => setTimeout(r, 5));

describe('messages queued while the agent answers', () => {
  it('holds them, publishes the list, and sends them in order when the answer ends', async () => {
    const { h, id, lists } = await setup();
    await h.sessions.sendOrQueue(id, 'second');
    await h.sessions.sendOrQueue(id, 'third');
    expect(h.sessions.queued(id).map((q) => q.text)).toEqual(['second', 'third']);
    expect(lists().at(-1)).toEqual(['second', 'third']);
    expect(h.agent.last.sent.map((s) => s.text)).toEqual(['first']);
    h.agent.last.reply('ok');
    await settle();
    // They go out in order, one answer each.
    expect(h.agent.last.sent.map((s) => s.text)).toEqual(['first', 'second']);
    expect(h.sessions.queued(id)).toEqual([]);
    expect(lists().at(-1)).toEqual([]);
    h.agent.last.reply('ok');
    await settle();
    expect(h.agent.last.sent.map((s) => s.text)).toEqual(['first', 'second', 'third']);
  });

  it('sends at once when nothing is being answered', async () => {
    const { h, id } = await setup();
    h.agent.last.reply('ok');
    await settle();
    await h.sessions.sendOrQueue(id, 'now');
    expect(h.sessions.queued(id)).toEqual([]);
    expect(h.agent.last.sent.map((s) => s.text)).toContain('now');
  });

  it('sends one queued message now: the answer stops and that message goes first', async () => {
    const { h, id } = await setup();
    await h.sessions.sendOrQueue(id, 'a');
    await h.sessions.sendOrQueue(id, 'b');
    const [, b] = h.sessions.queued(id);
    await h.sessions.queueNow(id, b?.id ?? '');
    expect(h.agent.last.interrupted).toBe(1);
    h.agent.last.reply('stopped');
    await settle();
    expect(h.agent.last.sent.map((s) => s.text)).toEqual(['first', 'b']);
    h.agent.last.reply('done');
    await settle();
    expect(h.agent.last.sent.map((s) => s.text)).toEqual(['first', 'b', 'a']);
  });

  it('drops a queued message', async () => {
    const { h, id } = await setup();
    await h.sessions.sendOrQueue(id, 'a');
    h.sessions.queueDrop(id, h.sessions.queued(id)[0]?.id ?? '');
    expect(h.sessions.queued(id)).toEqual([]);
  });
});
