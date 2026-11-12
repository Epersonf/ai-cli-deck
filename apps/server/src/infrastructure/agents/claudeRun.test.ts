import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AgentSpec } from '../../domain/agent.js';
import { claudeProjectDir } from '../chats/claudeChats.js';
import { createClaudeDriver } from './claudeDriver.js';
import { claudeRewind } from './claudeRewind.js';
import { fakeQuery, sink } from './fakeClaude.js';

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

describe('what the Claude driver passes the SDK for editing and checkpoints', () => {
  it('sends the user step id as the message uuid (only when it is one), and turns file checkpoints on', async () => {
    const fake = fakeQuery();
    const run = createClaudeDriver(fake.queryFn).start(spec, sink().s);
    run.send({ id: UID, text: 'a', images: [] });
    run.send({ id: 'not-a-uuid', text: 'b', images: [] });
    await tick();
    expect(fake.calls[0]?.options['enableFileCheckpointing']).toBe(true);
    expect(fake.calls[0]?.prompts).toMatchObject([{ uuid: UID }, {}]);
    expect(fake.calls[0]?.prompts[1]).not.toHaveProperty('uuid');
    fake.api.end();
  });

  it('resumes only up to the resume point, naming the turn it drops', async () => {
    const fake = fakeQuery();
    const run = createClaudeDriver(fake.queryFn).start(
      { ...spec, resumeAt: 'entry-7', dropsTurn: UID },
      sink().s,
    );
    run.send({ id: UID, text: 'a', images: [] });
    await tick();
    expect(fake.calls[0]?.options).toMatchObject({
      resume: 'chat-9',
      resumeSessionAt: 'entry-7',
      resumeDropsTurn: UID,
    });
    fake.api.end();
  });
});

describe('background tasks and the run', () => {
  it('stops a task through the SDK and reports the run ending with its tasks stopped', async () => {
    const fake = fakeQuery();
    const out = sink();
    const run = createClaudeDriver(fake.queryFn).start(spec, out.s);
    run.send({ id: UID, text: 'serve', images: [] });
    await tick();
    fake.api.emit({
      type: 'system',
      subtype: 'task_started',
      task_id: 'b1',
      description: 'dev',
      is_backgrounded: true,
    });
    fake.api.emit({ type: 'result', subtype: 'success' });
    await tick();
    run.stopTask('b1');
    expect(fake.api.stopped).toEqual(['b1']);
    fake.api.end();
    await tick();
    expect(out.events.filter((e) => e.t === 'task').at(-1)).toMatchObject({ state: 'stopped' });
    expect(out.ended()).toBe(1);
  });

  it('shows an answer the agent starts by itself as a turn, and ends it with the result', async () => {
    const fake = fakeQuery();
    const out = sink();
    const run = createClaudeDriver(fake.queryFn).start(spec, out.s);
    run.send({ id: UID, text: 'go', images: [] });
    await tick();
    fake.api.emit({ type: 'result', subtype: 'success' });
    await tick();
    out.events.length = 0;
    fake.api.emit({
      type: 'assistant',
      message: { id: 'm2', content: [{ type: 'text', text: 'The build finished.' }] },
    });
    fake.api.emit({ type: 'result', subtype: 'success' });
    await tick();
    expect(out.events.map((e) => e.t)).toEqual(['turn-start', 'text', 'turn-end']);
    fake.api.end();
  });
});

describe('going back in Claude', () => {
  it('restores the files through a separate query, and finds the entry before the message', async () => {
    const home = await mkdtemp(join(tmpdir(), 'deck-claude-'));
    try {
      const dir = claudeProjectDir(home, '/work');
      await mkdir(dir, { recursive: true });
      const lines = [
        { uuid: 'a1', parentUuid: null, type: 'user' },
        { uuid: 'a2', parentUuid: 'a1', type: 'assistant' },
        { uuid: UID, parentUuid: 'a2', type: 'user' },
      ];
      await writeFile(
        join(dir, 'chat-9.jsonl'),
        lines.map((l) => JSON.stringify(l)).join(String.fromCharCode(10)),
      );
      const fake = fakeQuery();
      const result = await claudeRewind(
        fake.queryFn,
        { ...spec, env: { CLAUDE_CONFIG_DIR: home } },
        UID,
        true,
      );
      expect(result).toEqual({ resumeAt: 'a2' });
      expect(fake.api.rewound).toEqual([UID]);
      expect(fake.calls[0]?.options).toMatchObject({
        resume: 'chat-9',
        enableFileCheckpointing: true,
      });
      const unknown = await claudeRewind(
        fake.queryFn,
        { ...spec, env: { CLAUDE_CONFIG_DIR: home } },
        'zzz',
        false,
      );
      expect(unknown).toEqual({ resumeAt: null });
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it('reports the files that cannot be restored, and goes no further', async () => {
    const fake = fakeQuery();
    fake.api.canRewind = false;
    const result = await claudeRewind(fake.queryFn, spec, UID, true);
    expect(result).toEqual({ resumeAt: null, error: 'No checkpoint' });
  });
});
