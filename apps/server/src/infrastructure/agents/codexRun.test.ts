import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { AgentSpec, UsageReading } from '../../domain/agent.js';
import { CodexRun } from './codexRun.js';
import { sink } from './fakeClaude.js';

const rollout = vi.hoisted(() => ({ read: vi.fn<() => Promise<UsageReading[]>>() }));
vi.mock('./codexRollout.js', () => ({ codexUsage: rollout.read }));
vi.mock('./codexBin.js', () => ({
  resolveCodex: () => ({
    command: process.execPath,
    prefix: [fileURLToPath(new URL('./fixtures/exec-server.mjs', import.meta.url))],
  }),
}));
const spec = (env: Record<string, string> = {}): AgentSpec => ({
  kind: 'codex',
  cwd: process.cwd(),
  env: { ...(process.env as Record<string, string>), ...env },
  model: null,
  mode: 'default',
  effort: null,
  resumeId: 'original-thread',
  fork: true,
  resumeAt: null,
  dropsTurn: null,
  mcpUrl: 'http://localhost:1/mcp',
  guide: 'stable',
});

describe('Codex exec lifecycle', () => {
  it('forks once, waits for rollout readings, then resumes the new thread with distinct turn metrics', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'deck-exec-'));
    const log = join(dir, 'calls');
    let release!: (readings: UsageReading[]) => void;
    rollout.read
      .mockReset()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValue([]);
    const { s, usage, ended } = sink();
    const run = new CodexRun(spec({ EXEC_LOG: log }), s);
    try {
      run.send({ id: 'first', text: 'first message', images: [] });
      await vi.waitFor(() => expect(rollout.read).toHaveBeenCalledTimes(1), { timeout: 5000 });
      run.send({ id: 'second', text: 'second message', images: [] });
      expect((await readFile(log, 'utf8')).trim().split('\n')).toHaveLength(1);
      release([{ contextTokens: 777 }]);
      await vi.waitFor(() => expect(ended()).toBe(1), { timeout: 5000 });
      const calls = (await readFile(log, 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as { args: string[]; text: string });
      expect(calls[0]?.args.slice(0, 3)).toEqual(['exec', 'fork', 'original-thread']);
      expect(calls[1]?.args.slice(0, 3)).toEqual(['exec', 'resume', 'forked-thread']);
      expect(calls[1]?.text).toBe('second message');
      expect(usage.flatMap((reading) => (reading.turn ? [reading.turn.id] : []))).toEqual([
        'first:',
        'second:',
      ]);
    } finally {
      run.close();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('ignores a rollout that finishes reading after the run was closed', async () => {
    let release!: (readings: UsageReading[]) => void;
    rollout.read.mockReset().mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const { s, usage, ended } = sink();
    const run = new CodexRun(spec(), s);
    run.send({ id: 'first', text: 'hello', images: [] });
    await vi.waitFor(() => expect(rollout.read).toHaveBeenCalledTimes(1), { timeout: 5000 });
    run.close();
    release([{ contextTokens: 999_999 }]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(usage.some((reading) => reading.contextTokens === 999_999)).toBe(false);
    expect(ended()).toBe(0);
  });
});
