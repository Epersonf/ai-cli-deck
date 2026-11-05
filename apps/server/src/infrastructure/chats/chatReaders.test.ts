import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { claudeChats, claudeProjectDir } from './claudeChats.js';
import { codexChats } from './codexChats.js';

const lines = (...items: unknown[]): string =>
  items.map((i) => JSON.stringify(i)).join('\n') + '\n';
let home = '';
beforeEach(async () => void (home = await mkdtemp(join(tmpdir(), 'deck-chats-'))));
afterEach(() => rm(home, { recursive: true, force: true }));

describe('Claude Code chats', () => {
  const user = (content: unknown, extra = {}) => ({
    type: 'user',
    timestamp: '2026-01-01T10:00:00.000Z',
    message: { role: 'user', content },
    ...extra,
  });
  const assistant = (content: unknown) => ({
    type: 'assistant',
    message: { role: 'assistant', content },
  });

  it('lists a folder’s chats by their first request and reads them without tool output', async () => {
    const dir = claudeProjectDir(home, '/root/my.app');
    expect(dir.endsWith(join('projects', '-root-my-app'))).toBe(true);
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, 'abc-123.jsonl'),
      lines(
        { type: 'system', content: 'started' },
        user('<command-name>/clear</command-name>'),
        user('Caveat: injected', { isMeta: true }),
        user('fix the login bug'),
        assistant([
          { type: 'thinking', thinking: 'hmm' },
          { type: 'text', text: 'Running the tests.' },
          { type: 'tool_use', name: 'Bash', input: { command: 'npm test' } },
        ]),
        user([{ type: 'tool_result', content: 'PASS 12 tests' }]),
        assistant([{ type: 'text', text: 'All green.' }]),
        {
          ...assistant([{ type: 'text', text: 'API Error: overloaded' }]),
          isApiErrorMessage: true,
        },
        user('a side chat', { isSidechain: true }),
      ),
    );
    await writeFile(join(dir, 'empty.jsonl'), lines({ type: 'system', content: 'nothing asked' }));
    const [entry, ...rest] = await claudeChats.list(home, '/root/my.app');
    expect(rest).toEqual([]);
    expect(entry).toMatchObject({ id: 'abc-123', title: 'fix the login bug' });
    expect(entry?.startedAt.toISOString()).toBe('2026-01-01T10:00:00.000Z');
    expect(await claudeChats.read(entry ?? never())).toEqual([
      { role: 'user', text: 'fix the login bug' },
      { role: 'assistant', text: 'Running the tests.' },
      { role: 'tool', text: 'Bash: npm test' },
      { role: 'assistant', text: 'All green.' },
    ]);
    expect(await claudeChats.list(home, '/elsewhere')).toEqual([]);
  });
});

describe('Codex chats', () => {
  const meta = (id: string, cwd: string, source = 'cli') => ({
    type: 'session_meta',
    payload: {
      id,
      cwd,
      source,
      originator: 'codex-tui',
      timestamp: '2026-01-02T08:00:00.000Z',
      base_instructions: { text: 'x'.repeat(150_000) }, // the real first line is this big
    },
  });
  const message = (role: string, text: string) => ({
    type: 'response_item',
    payload: {
      type: 'message',
      role,
      content: [{ type: role === 'user' ? 'input_text' : 'output_text', text }],
    },
  });

  it('finds the chats started in a folder, skipping `codex exec` runs and other folders', async () => {
    const day = join(home, 'sessions', '2026', '01', '02');
    await mkdir(day, { recursive: true });
    const rollout = (name: string, ...items: unknown[]) =>
      writeFile(join(day, `rollout-${name}.jsonl`), lines(...items));
    await rollout(
      '2026-01-02T08-00-00-aaa',
      meta('aaa', '/work'),
      message('developer', 'rules'),
      message('user', '<environment_context>cwd</environment_context>'),
      message('user', 'add a dark mode'),
      {
        type: 'response_item',
        payload: {
          type: 'function_call',
          name: 'shell',
          arguments: '{"command":["npm","run","build"]}',
        },
      },
      message('assistant', 'Done, dark mode added.'),
    );
    await rollout(
      '2026-01-02T09-00-00-bbb',
      meta('bbb', '/work', 'exec'),
      message('user', 'ci job'),
    );
    await rollout('2026-01-02T10-00-00-ccc', meta('ccc', '/other'), message('user', 'elsewhere'));
    const chats = await codexChats.list(home, '/work');
    expect(chats.map((c) => [c.id, c.title])).toEqual([['aaa', 'add a dark mode']]);
    expect(await codexChats.read(chats[0] ?? never())).toEqual([
      { role: 'user', text: 'add a dark mode' },
      { role: 'tool', text: 'shell: npm run build' },
      { role: 'assistant', text: 'Done, dark mode added.' },
    ]);
  });
});

function never(): never {
  throw new Error('expected a chat');
}
