import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentSpec } from '../../../domain/agent.js';
import { sink } from '../../../infrastructure/agents/fakeClaude.js';
import { compactCodex } from './codexCompact.js';

vi.mock('./codexBin.js', () => ({
  resolveCodex: () => ({
    command: process.execPath,
    prefix: [fileURLToPath(new URL('./fixtures/compact-server.mjs', import.meta.url))],
  }),
}));

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
const spec = (env: Record<string, string> = {}): AgentSpec => ({
  kind: 'codex',
  cwd: process.cwd(),
  env: { ...(process.env as Record<string, string>), ...env },
  model: 'test-model',
  mode: 'plan',
  effort: 'low',
  autoCompact: 100_000,
  resumeId: 'thread-1',
  fork: false,
  resumeAt: null,
  dropsTurn: null,
  mcpUrl: 'http://127.0.0.1:1/mcp/test',
  guide: 'Keep the stable briefing.',
});

describe('native Codex compaction', () => {
  it('initializes, resumes the exact thread and waits for completion, not the RPC acknowledgement', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'deck-compact-'));
    dirs.push(dir);
    const log = join(dir, 'requests.jsonl');
    const { s, usage, events } = sink();
    await compactCodex(
      spec({ COMPACT_LOG: log, COMPACT_MODE: 'retry' }),
      s,
      new AbortController().signal,
    );
    const requests = (await readFile(log, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(requests.at(-1)).toEqual({ notification: 'completed' });
    expect(requests.filter((r) => r['method']).map((r) => r['method'])).toEqual([
      'initialize',
      'initialized',
      'thread/resume',
      'thread/compact/start',
    ]);
    expect(requests[2]?.['params']).toMatchObject({
      threadId: 'thread-1',
      excludeTurns: true,
      developerInstructions: 'Keep the stable briefing.',
      model: 'test-model',
    });
    expect(usage).toEqual([{ compacted: true }]);
    expect(events).toEqual([]); // no ordinary user/assistant turn and no duplicate completion notification
  });

  it.each(['error', 'exit', 'failed'])(
    'reports %s without claiming successful compaction',
    async (mode) => {
      const { s, usage } = sink();
      await expect(
        compactCodex(spec({ COMPACT_MODE: mode }), s, new AbortController().signal),
      ).rejects.toThrow();
      expect(usage).toEqual([]);
    },
  );

  it('cancels an active compaction and rejects an already aborted operation', async () => {
    const { s, usage } = sink();
    const controller = new AbortController();
    const pending = compactCodex(spec({ COMPACT_MODE: 'hang' }), s, controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow('cancelled');
    await expect(compactCodex(spec(), s, controller.signal)).rejects.toThrow('cancelled');
    expect(usage).toEqual([]);
  });

  it('does not compact a parent thread while a fork is still pending', async () => {
    const { s } = sink();
    await expect(
      compactCodex({ ...spec(), fork: true }, s, new AbortController().signal),
    ).rejects.toThrow('before compacting');
    await expect(
      compactCodex({ ...spec(), resumeId: null }, s, new AbortController().signal),
    ).rejects.toThrow('before compacting');
  });
});
