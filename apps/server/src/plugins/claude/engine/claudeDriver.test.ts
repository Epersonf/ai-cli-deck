import { describe, expect, it } from 'vitest';
import type { AgentSpec } from '../../../domain/agent.js';
import { createClaudeDriver } from './claudeDriver.js';
import { fakeQuery, sink } from '../../../infrastructure/agents/fakeClaude.js';

const spec: AgentSpec = {
  kind: 'claude',
  cwd: '/work',
  env: { ANTHROPIC_BASE_URL: 'https://gw.example.com' },
  model: 'sonnet',
  mode: 'default',
  effort: null,
  resumeId: 'chat-9',
  fork: false,
  resumeAt: null,
  dropsTurn: null,
  mcpUrl: 'http://127.0.0.1:7842/mcp/s1',
  guide: 'You run in the deck.',
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe('the Claude driver', () => {
  it('starts the SDK with the deck briefing, MCP server, environment and resume id', async () => {
    const fake = fakeQuery();
    const { s } = sink();
    const run = createClaudeDriver(fake.queryFn).start(spec, s);
    run.send({ id: 'u1', text: 'hello', images: [{ mediaType: 'image/png', data: 'AAAA' }] });
    await tick();
    const { options, prompts } = fake.calls[0] ?? { options: {}, prompts: [] };
    expect(options).toMatchObject({
      cwd: '/work',
      env: { ANTHROPIC_BASE_URL: 'https://gw.example.com' },
      model: 'sonnet',
      resume: 'chat-9',
      forkSession: false,
      includePartialMessages: true,
      permissionMode: 'default',
      mcpServers: { deck: { type: 'http', url: spec.mcpUrl } },
      systemPrompt: { preset: 'claude_code', append: 'You run in the deck.' },
    });
    const content = (prompts[0] as { message: { content: unknown[] } }).message.content;
    expect(content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } },
      { type: 'text', text: 'hello' },
    ]);
    fake.api.end();
  });

  it('turns permission requests into steps and answers the SDK', async () => {
    const fake = fakeQuery();
    const { s, events } = sink();
    const run = createClaudeDriver(fake.queryFn).start(spec, s);
    run.send({ id: 'u1', text: 'go', images: [] });
    await tick();
    const canUseTool = fake.calls[0]?.options['canUseTool'] as (
      tool: string,
      input: Record<string, unknown>,
      o: { signal: AbortSignal; suggestions?: unknown[] },
    ) => Promise<Record<string, unknown>>;
    const pending = canUseTool(
      'Bash',
      { command: 'rm x' },
      {
        signal: new AbortController().signal,
        suggestions: [{ type: 'addRules' }],
      },
    );
    const asked = events.find((e) => e.t === 'permission');
    expect(asked).toMatchObject({ tool: 'Bash', canAlways: true });
    run.answer(asked?.t === 'permission' ? asked.id : '', { allow: true, always: true });
    expect(await pending).toEqual({
      behavior: 'allow',
      updatedInput: { command: 'rm x' },
      updatedPermissions: [{ type: 'addRules' }],
    });
    expect(events.at(-1)).toMatchObject({ t: 'permission-done', allowed: true });
    fake.api.end();
  });

  it('reports a stopped answer as finished, and a crash as an error, then tells it ended', async () => {
    const fake = fakeQuery();
    const first = sink();
    const run = createClaudeDriver(fake.queryFn).start(spec, first.s);
    run.send({ id: 'u1', text: 'go', images: [] });
    await tick();
    run.interrupt();
    expect(fake.api.interrupted).toBe(1);
    fake.api.emit({ type: 'result', subtype: 'error_during_execution', is_error: true });
    await tick();
    expect(first.events.at(-1)).toMatchObject({ t: 'turn-end', error: null });

    const crash = fakeQuery();
    const second = sink();
    const run2 = createClaudeDriver(() => {
      throw new Error('spawn failed');
    }).start(spec, second.s);
    run2.send({ id: 'u1', text: 'go', images: [] });
    await tick();
    expect(second.events.at(-1)).toMatchObject({ t: 'turn-end', error: 'spawn failed' });
    expect(second.ended()).toBe(1);
    expect(crash.calls).toEqual([]);
    fake.api.end();
  });

  it('changes the model of a running conversation', async () => {
    const fake = fakeQuery();
    const { s } = sink();
    const run = createClaudeDriver(fake.queryFn).start(spec, s);
    run.send({ id: 'u1', text: 'go', images: [] });
    await tick();
    run.setConfig({ model: 'opus' });
    expect(fake.api.models).toEqual(['opus']);
    fake.api.end();
  });
});
