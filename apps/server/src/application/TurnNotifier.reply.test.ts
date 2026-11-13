import { describe, expect, it } from 'vitest';
import { agentBody, createHarness } from '../testing/harness.js';
import { TurnNotifier } from './TurnNotifier.js';

async function setup() {
  const h = createHarness();
  const phone: Array<[string, string, unknown]> = [];
  new TurnNotifier({
    bus: h.bus,
    phone: { request: (m, p, b) => (phone.push([m, p, b]), Promise.resolve(null)) },
    label: (id) => id,
    replyUrl: (id) => `http://127.0.0.1:1/agent/reply/token-of-${id}`,
  }).start();
  const { id } = await h.sessions.create(agentBody());
  await h.sessions.send(id, 'go');
  return { h, phone, id };
}

describe('the Reply box on the phone notification', () => {
  it('comes with a finished answer, so it can be answered from the notification', async () => {
    const { h, phone, id } = await setup();
    h.agent.last.reply('All done.');
    expect(phone).toEqual([
      [
        'POST',
        '/notify',
        {
          title: id,
          text: 'All done.',
          sessionId: id,
          replyUrl: `http://127.0.0.1:1/agent/reply/token-of-${id}`,
        },
      ],
    ]);
  });

  it('is not offered on a request for approval, where a typed reply makes no sense', async () => {
    const { h, phone, id } = await setup();
    h.bus.publish({
      kind: 'chat',
      sessionId: id,
      event: { t: 'permission', id: 'p1', tool: 'Bash', input: {}, canAlways: false, reason: null },
    });
    expect(phone).toHaveLength(1);
    expect(phone[0]?.[2]).not.toHaveProperty('replyUrl');
  });
});
