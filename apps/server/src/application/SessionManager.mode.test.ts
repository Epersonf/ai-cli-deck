import { describe, expect, it } from 'vitest';
import { agentBody, createHarness } from '../testing/harness.js';

describe('the permission mode a person chose', () => {
  it('becomes the start of new chats of that provider, and shows in their first config', async () => {
    const h = createHarness();
    const first = await h.sessions.create(agentBody());
    h.sessions.configure(first.id, { mode: 'auto' });
    expect(h.models.modeOf('claude')).toBe('auto');
    const next = await h.sessions.create(agentBody());
    expect((await h.sessions.snapshot(next.id)).config.mode).toBe('auto');
    await h.sessions.send(next.id, 'hi');
    expect(h.agent.last.spec.mode).toBe('auto');
    const codex = await h.sessions.create({ ...agentBody(), provider: 'codex' });
    expect((await h.sessions.snapshot(codex.id)).config.mode).toBe('default');
  });

  it('stays with each chat across a server restart, whatever the default became since', async () => {
    const first = createHarness();
    const { id } = await first.sessions.create(agentBody());
    first.sessions.configure(id, { mode: 'dontAsk' });
    first.sessions.configure((await first.sessions.create(agentBody())).id, { mode: 'plan' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const second = createHarness({ stored: first.store.saved });
    await second.sessions.restore();
    second.models.setMode('claude', 'bypassPermissions');
    expect((await second.sessions.snapshot(id)).config.mode).toBe('dontAsk');
    expect(second.sessions.get(id)?.meta['mode']).toBe('dontAsk');
  });
});
