import { describe, expect, it } from 'vitest';
import { input, setup } from './antigravityTestKit.js';

describe('official Antigravity ACP lifecycle', () => {
  it('connects Deck MCP, streams tools/thinking/text, and reuses a session with distinct ids', async () => {
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
    expect(t.usage).toContainEqual({
      contextTokens: 1200,
      contextWindow: 1048576,
      costUsd: 0.05,
    });
    expect(t.usage).toContainEqual(
      expect.objectContaining({
        contextTokens: 1250,
        turn: expect.objectContaining({ id: 'first', input: 1000, output: 250, cached: 400 }),
        cache: expect.objectContaining({ scope: 'turn', read: 400, write: 100, uncached: 600 }),
      }),
    );
    expect(t.ended()).toBe(0);
  });

  it.each([false, true])(
    'resumes saved sessions and suppresses replayed history (load=%s)',
    async (load) => {
      const t = await setup(load ? { AGY_TEST_LOAD: '1' } : {}, { resumeId: 'agy-chat' });
      t.run.send(input());
      await t.done();
      expect(
        (await t.calls()).some(
          (call) => call.method === (load ? 'session/load' : 'session/resume'),
        ),
      ).toBe(true);
      expect(JSON.stringify(t.events)).not.toContain('old history');
      const prompt = (await t.calls()).find((call) => call.method === 'session/prompt');
      expect(prompt?.params?.prompt).toEqual([{ type: 'text', text: 'hello' }]);
    },
  );

  it('applies model, thinking level and permission mode before sending images', async () => {
    const t = await setup({}, { model: 'model-b', effort: 'xhigh', mode: 'acceptEdits' });
    t.run.send({ ...input(), images: [{ mediaType: 'image/png', data: 'aGVsbG8=' }] });
    await t.done();
    const calls = await t.calls();
    expect(calls.find((call) => call.method === 'session/set_mode')?.params?.modeId).toBe(
      'accept-edits',
    );
    expect(
      calls
        .filter((call) => call.method === 'session/set_config_option')
        .map((call) => call.params),
    ).toEqual([
      { sessionId: 'agy-chat', configId: 'model', value: 'model-b' },
      { sessionId: 'agy-chat', configId: 'thinking', value: 'extra' },
    ]);
    expect(calls.find((call) => call.method === 'session/prompt')?.params?.prompt).toContainEqual({
      type: 'image',
      data: 'aGVsbG8=',
      mimeType: 'image/png',
    });
  });
});
