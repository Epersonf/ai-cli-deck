import type * as ChildProcess from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, vi } from 'vitest';
import type { AgentSpec } from '../../../domain/agent.js';
import { AntigravityRun } from './antigravityRun.js';
import { sink } from '../../../infrastructure/agents/fakeClaude.js';

vi.mock('node:child_process', async (original) => {
  const actual = await original<typeof ChildProcess>();
  return {
    ...actual,
    spawn: (_command: string, args: string[], options: object) =>
      actual.spawn(
        process.execPath,
        [fileURLToPath(new URL('./fixtures/antigravity-server.mjs', import.meta.url)), ...args],
        options,
      ),
  };
});

const spec = (env: Record<string, string> = {}, extra: Partial<AgentSpec> = {}): AgentSpec => ({
  kind: 'antigravity',
  cwd: process.cwd(),
  env: { ...process.env, ...env } as Record<string, string>,
  model: null,
  mode: 'default',
  effort: null,
  resumeId: null,
  fork: false,
  resumeAt: null,
  dropsTurn: null,
  mcpUrl: 'http://localhost:1/mcp/session',
  guide: 'Deck briefing and memory',
  ...extra,
});
export const input = (text = 'hello', id = 'first') => ({ id, text, images: [] });
const runs: AntigravityRun[] = [];
const dirs: string[] = [];
afterEach(async () => {
  runs.splice(0).forEach((run) => run.close());
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
export async function setup(env: Record<string, string> = {}, extra: Partial<AgentSpec> = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'deck-agy-'));
  dirs.push(dir);
  const log = join(dir, 'calls');
  const captured = sink();
  const run = new AntigravityRun(spec({ ...env, AGY_TEST_LOG: log }, extra), captured.s);
  runs.push(run);
  const calls = async () =>
    (await readFile(log, 'utf8'))
      .trim()
      .split('\n')
      .map(
        (line) =>
          JSON.parse(line) as {
            method?: string;
            params?: Record<string, unknown>;
            id?: unknown;
            result?: unknown;
          },
      );
  const done = (count = 1) =>
    vi.waitFor(
      () => expect(captured.events.filter((event) => event.t === 'turn-end')).toHaveLength(count),
      { timeout: 5000 },
    );
  return { ...captured, run, calls, done };
}
