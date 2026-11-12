import { describe, expect, it } from 'vitest';
import { setupAgents } from '../testing/agentKit.js';
import { TurnNotifier } from './TurnNotifier.js';

describe('approvals for the memory', () => {
  it('notify the person when an agent asks to write globally or import', async () => {
    const { h, tools, a } = await setupAgents();
    const phone: unknown[] = [];
    new TurnNotifier({
      bus: h.bus,
      phone: { request: (...args) => (phone.push(args), Promise.resolve(null)) },
      label: () => 'Chat',
    }).start();
    await tools.memory.write({ title: 'Rule', body: 'x', scope: 'global' });
    const notes = h.events.filter((e) => e.kind === 'notify');
    expect(notes).toMatchObject([
      { sessionId: a.id, reason: 'permission', text: 'Add "Rule" to the global memory' },
    ]);
    expect(phone).toHaveLength(1);
  });
});
