import type { DeckEvent } from '../domain/events.js';
import { describe, expect, it } from 'vitest';
import { agentBody, createHarness } from '../testing/harness.js';

const configs = (events: DeckEvent[]) =>
  events.flatMap((e) => (e.kind === 'config' ? [e.config] : []));

describe('models of a chat', () => {
  it('offers what the agent says it has, and shows it once the answer arrives', async () => {
    const h = createHarness();
    h.listing.choices = [{ id: 'opus', label: 'Opus 5.5', description: 'Best' }];
    const { id } = await h.sessions.create(agentBody());
    expect((await h.sessions.snapshot(id)).config.modelChoices).toEqual([]);
    await h.catalog.refresh('claude');
    expect(configs(h.events).at(-1)?.modelChoices).toEqual(h.listing.choices);
    expect((await h.sessions.snapshot(id)).config.modelChoices).toHaveLength(1);
  });

  it('knows the model really answering, keeps it for the next empty chat of that provider', async () => {
    const h = createHarness();
    const { id } = await h.sessions.create(agentBody());
    await h.sessions.send(id, 'hi');
    expect((await h.sessions.snapshot(id)).config.effectiveModel).toBeNull();
    h.agent.last.sink.model('claude-sonnet-5-5');
    expect(configs(h.events).at(-1)?.effectiveModel).toBe('claude-sonnet-5-5');
    h.agent.last.sink.model('claude-opus-5');
    expect(configs(h.events).at(-1)?.effectiveModel).toBe('claude-opus-5');
    const other = await h.sessions.create(agentBody());
    expect((await h.sessions.snapshot(other.id)).config.effectiveModel).toBe('claude-opus-5');
  });

  it('starts a new chat on the default, shows it, and a chat model of null returns to it', async () => {
    const h = createHarness();
    h.models.setDefault('claude', 'opus');
    const { id } = await h.sessions.create(agentBody());
    const { config } = await h.sessions.snapshot(id);
    expect(config).toMatchObject({ model: null, defaultModel: 'opus', effectiveModel: 'opus' });
    await h.sessions.send(id, 'hi');
    expect(h.agent.last.spec.model).toBe('opus');
    h.sessions.configure(id, { model: 'haiku' });
    h.sessions.configure(id, { model: null });
    expect(h.agent.last.configs).toEqual([{ model: 'haiku' }, { model: 'opus' }]);
  });

  it('changing the default reaches open chats without a model of their own, not the others', async () => {
    const h = createHarness();
    const plain = await h.sessions.create(agentBody());
    const own = await h.sessions.create(agentBody());
    h.sessions.configure(own.id, { model: 'haiku' });
    await h.sessions.send(plain.id, 'a');
    await h.sessions.send(own.id, 'b');
    const [plainRun, ownRun] = h.agent.runs;
    h.events.length = 0;
    h.models.setDefault('claude', 'sonnet');
    expect(plainRun?.configs).toEqual([{ model: 'sonnet' }]);
    expect(ownRun?.configs).toEqual([]);
    const pushed = h.events.filter((e) => e.kind === 'config');
    expect(pushed).toHaveLength(2);
    h.models.setDefault('claude', null);
    expect(configs(h.events).at(-1)?.defaultModel).toBeNull();
  });

  it('starts a profile of another provider on its own default', async () => {
    const h = createHarness();
    h.models.setDefault('codex', 'gpt-6-luna');
    const { id } = await h.sessions.create({ ...agentBody(), provider: 'codex' });
    await h.sessions.send(id, 'hi');
    expect(h.agent.last.spec.model).toBe('gpt-6-luna');
  });
});
