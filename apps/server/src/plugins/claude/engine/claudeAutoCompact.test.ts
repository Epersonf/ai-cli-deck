import { describe, expect, it } from 'vitest';
import type { AgentSpec } from '../../../domain/agent.js';
import { createClaudeDriver } from './claudeDriver.js';
import { fakeQuery, sink } from '../../../infrastructure/agents/fakeClaude.js';

const UID = '3b241101-e2bb-4255-8caf-4136c566a962';
const spec: AgentSpec = {
  kind: 'claude',
  cwd: '/work',
  env: {},
  model: null,
  mode: 'default',
  effort: null,
  resumeId: 'chat-9',
  fork: false,
  resumeAt: null,
  dropsTurn: null,
  mcpUrl: 'http://127.0.0.1:1/mcp/s',
  guide: '',
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe('auto-compact in Claude', () => {
  it('starts with the settings for the window or for never, and leaves the default alone', async () => {
    const options = async (autoCompact: number | 'off' | null) => {
      const fake = fakeQuery();
      const run = createClaudeDriver(fake.queryFn).start({ ...spec, autoCompact }, sink().s);
      run.send({ id: UID, text: 'a', images: [] });
      await tick();
      fake.api.end();
      return fake.calls[0]?.options;
    };
    expect((await options(150_000))?.['settings']).toEqual({
      autoCompactEnabled: true,
      autoCompactWindow: 150_000,
    });
    expect((await options('off'))?.['settings']).toEqual({ autoCompactEnabled: false });
    expect(await options(null)).not.toHaveProperty('settings');
  });

  it('changes it live, and clears it when the person goes back to the default', async () => {
    const fake = fakeQuery();
    const run = createClaudeDriver(fake.queryFn).start(spec, sink().s);
    run.send({ id: UID, text: 'a', images: [] });
    await tick();
    run.setConfig({ autoCompact: 200_000 });
    run.setConfig({ autoCompact: null });
    expect(fake.api.flagSettings).toEqual([
      { autoCompactEnabled: true, autoCompactWindow: 200_000 },
      { autoCompactEnabled: null, autoCompactWindow: null },
    ]);
    fake.api.end();
  });
});

describe('what keeps the prompt cache', () => {
  const optionsOf = async (env: Record<string, string>) => {
    const fake = fakeQuery();
    const run = createClaudeDriver(fake.queryFn).start({ ...spec, env }, sink().s);
    run.send({ id: UID, text: 'a', images: [] });
    await tick();
    fake.api.end();
    return fake.calls[0]?.options;
  };

  it('records the system prompt with the conversation instead of rendering it again', async () => {
    expect((await optionsOf({}))?.['systemPrompt']).toMatchObject({
      snapshot: true,
      excludeDynamicSections: true,
    });
  });

  it('asks for the hour cache only for a long-lived token, which Claude Code does not know as a plan', async () => {
    expect(await optionsOf({})).not.toHaveProperty('settings');
    expect((await optionsOf({ CLAUDE_CODE_OAUTH_TOKEN: 'sk-ant-oat' }))?.['settings']).toEqual({
      promptCacheTtl: '1h',
    });
    expect(
      await optionsOf({ CLAUDE_CODE_OAUTH_TOKEN: 'x', ANTHROPIC_BASE_URL: 'https://other' }),
    ).not.toHaveProperty('settings');
  });
});

describe('the prompt of another endpoint', () => {
  const envOf = async (env: Record<string, string>) => {
    const fake = fakeQuery();
    const run = createClaudeDriver(fake.queryFn).start({ ...spec, env }, sink().s);
    run.send({ id: UID, text: 'a', images: [] });
    await tick();
    fake.api.end();
    return fake.calls[0]?.options['env'];
  };

  it('has no line of its own at the start, which would change the prefix the cache matches', async () => {
    const deepseek = await envOf({ ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic' });
    expect(deepseek).toMatchObject({ CLAUDE_CODE_ATTRIBUTION_HEADER: '0' });
  });

  it('is left alone for Anthropic, with no endpoint, or when the profile already says', async () => {
    expect(await envOf({})).not.toHaveProperty('CLAUDE_CODE_ATTRIBUTION_HEADER');
    expect(await envOf({ ANTHROPIC_BASE_URL: 'https://api.anthropic.com' })).not.toHaveProperty(
      'CLAUDE_CODE_ATTRIBUTION_HEADER',
    );
    expect(
      await envOf({ ANTHROPIC_BASE_URL: 'https://x.test', CLAUDE_CODE_ATTRIBUTION_HEADER: '1' }),
    ).toMatchObject({ CLAUDE_CODE_ATTRIBUTION_HEADER: '1' });
  });
});
