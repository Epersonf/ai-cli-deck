import type { DeckEvent } from '../domain/events.js';
import { describe, expect, it } from 'vitest';
import { agentBody, createHarness } from '../testing/harness.js';
import { TurnNotifier } from './TurnNotifier.js';

function setup() {
  const h = createHarness();
  const phone: Array<[string, string, unknown]> = [];
  new TurnNotifier({
    bus: h.bus,
    phone: { request: (m, p, b) => (phone.push([m, p, b]), Promise.resolve(null)) },
    label: (id) => h.sessions.get(id)?.name ?? id,
  }).start();
  const notes = () =>
    h.events.filter((e): e is Extract<DeckEvent, { kind: 'notify' }> => e.kind === 'notify');
  return { h, phone, notes };
}

describe('telling the person an answer is done', () => {
  it('notifies every device and the phone with the chat name and the first line of the answer', async () => {
    const { h, phone, notes } = setup();
    const { id } = await h.sessions.create(agentBody());
    await h.sessions.send(id, 'go');
    h.agent.last.reply('\nAll done.\nSecond line');
    expect(notes()).toEqual([
      { kind: 'notify', sessionId: id, title: id, text: 'All done.', reason: 'done' },
    ]);
    expect(phone).toEqual([['POST', '/notify', { title: id, text: 'All done.' }]]);
  });

  it('says why an answer failed (without the sign-in marker) and when approval is needed', async () => {
    const { h, notes } = setup();
    const { id } = await h.sessions.create(agentBody());
    await h.sessions.send(id, 'go');
    h.agent.last.sink.event({
      t: 'permission',
      id: 'p',
      tool: 'Bash',
      input: {},
      canAlways: false,
      reason: null,
    });
    h.agent.last.sink.event({
      t: 'turn-end',
      error: 'Not logged in',
      costUsd: null,
      durationMs: null,
    });
    expect(notes().map((n) => [n.reason, n.text])).toEqual([
      ['permission', 'Needs approval: Bash'],
      ['error', 'Not logged in'],
    ]);
  });

  it('does not notify for an answer the person stopped', async () => {
    const { h, notes } = setup();
    const { id } = await h.sessions.create(agentBody());
    await h.sessions.send(id, 'go');
    h.sessions.interrupt(id);
    h.agent.last.sink.event({ t: 'turn-end', error: null, costUsd: null, durationMs: null });
    expect(notes()).toEqual([]);
    await h.sessions.send(id, 'again');
    h.agent.last.reply('ok');
    expect(notes()).toHaveLength(1);
  });
});
