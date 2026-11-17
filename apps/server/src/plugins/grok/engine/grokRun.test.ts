import { describe, expect, it, vi } from 'vitest';
import { input, setup } from './grokTestKit.js';

describe('official Grok Build ACP lifecycle', () => {
  it('connects Deck MCP, streams tools/thinking/text and reuses one session', async () => {
    const t = await setup();
    t.run.send(input());
    await t.done();
    t.run.send(input('second message', 'second'));
    await t.done(2);
    const calls = await t.calls();
    expect(calls.filter((call) => call.method === 'initialize')).toHaveLength(1);
    expect(calls.find((call) => call.method === 'session/new')?.params).toMatchObject({
      mcpServers: [{ name: 'deck', type: 'http', url: 'http://localhost:1/mcp/session' }],
    });
    const prompts = calls.filter((call) => call.method === 'session/prompt');
    expect(prompts[0]?.params?.prompt).toEqual([
      { type: 'text', text: expect.stringContaining('Deck briefing and memory') },
      { type: 'text', text: 'hello' },
    ]);
    expect(prompts[1]?.params?.prompt).toEqual([{ type: 'text', text: 'second message' }]);
    expect(t.events.filter((event) => event.t === 'text')).toEqual([
      { t: 'text', id: 'first:block:2', text: 'Hello world' },
      { t: 'text', id: 'second:block:2', text: 'Hello world' },
    ]);
    expect(t.events).toContainEqual({
      t: 'tool-result',
      id: 'first:tool:read',
      output: 'file content',
      isError: false,
    });
    expect(t.usage).toContainEqual(
      expect.objectContaining({
        contextTokens: 1500,
        contextWindow: 256000,
        costUsd: expect.closeTo(0.053204, 6),
        turn: expect.objectContaining({ id: 'second', input: 3000, output: 40, cached: 1000 }),
        cache: { scope: 'turn', read: 1000, write: 5, uncached: 2000, ttlMs: null },
      }),
    );
    expect(t.ended()).toBe(0);
  });

  it('resumes a saved session without repeating the briefing', async () => {
    const t = await setup({}, { resumeId: 'grok-chat' });
    t.run.send(input());
    await t.done();
    const calls = await t.calls();
    expect(calls.find((call) => call.method === 'session/resume')?.params).toMatchObject({
      sessionId: 'grok-chat',
    });
    expect(calls.find((call) => call.method === 'session/prompt')?.params?.prompt).toEqual([
      { type: 'text', text: 'hello' },
    ]);
  });

  it('applies the model and effort Grok advertises, then sends images', async () => {
    const t = await setup({}, { model: 'grok-4.5', effort: 'xhigh' });
    t.run.send({ ...input(), images: [{ mediaType: 'image/png', data: 'aGVsbG8=' }] });
    await t.done();
    const calls = await t.calls();
    expect(
      calls.filter((call) => call.method === 'session/set_config_option').map((c) => c.params),
    ).toEqual([
      { sessionId: 'grok-chat', configId: 'model', value: 'grok-4.5' },
      { sessionId: 'grok-chat', configId: 'reasoning_effort', value: 'xhigh' },
    ]);
    expect(calls.some((call) => call.method === 'session/set_mode')).toBe(false);
    expect(calls.find((call) => call.method === 'session/prompt')?.params?.prompt).toContainEqual({
      type: 'image',
      data: 'aGVsbG8=',
      mimeType: 'image/png',
    });
  });

  it('refuses a model the account does not offer', async () => {
    const t = await setup({}, { model: 'grok-9' });
    t.run.send(input());
    await t.done();
    expect(t.events).toContainEqual(
      expect.objectContaining({ t: 'turn-end', error: expect.stringContaining('grok-9') }),
    );
  });

  it('rejects images when the CLI does not accept them', async () => {
    const t = await setup({ GROK_TEST_NO_IMAGES: '1' });
    t.run.send({ ...input(), images: [{ mediaType: 'image/png', data: 'aGVsbG8=' }] });
    await t.done();
    expect(t.events).toContainEqual(
      expect.objectContaining({ t: 'turn-end', error: expect.stringContaining('image') }),
    );
  });

  it('stops the answer in progress', async () => {
    const t = await setup();
    t.run.send(input('long wait'));
    await vi.waitFor(async () =>
      expect((await t.calls()).some((call) => call.method === 'session/prompt')).toBe(true),
    );
    t.run.interrupt();
    await t.done();
    expect(t.events).toContainEqual(expect.objectContaining({ t: 'turn-end', error: null }));
  });

  it('reports a missing sign-in as an authentication error and ends the run', async () => {
    const t = await setup({ GROK_TEST_AUTH_ERROR: '1' });
    t.run.send(input());
    await t.done();
    expect(t.ended()).toBe(1);
    expect(JSON.stringify(t.events)).toContain('Authentication required');
  });
});
