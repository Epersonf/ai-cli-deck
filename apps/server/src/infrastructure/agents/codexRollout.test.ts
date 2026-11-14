import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { codexTokenCount, codexUsage } from './codexRollout.js';

const line = (payload: unknown): string =>
  JSON.stringify({ timestamp: 't', type: 'event_msg', payload });

const count = line({
  type: 'token_count',
  info: {
    total_token_usage: { input_tokens: 99_999 },
    last_token_usage: { input_tokens: 12_000, cached_input_tokens: 9_000, output_tokens: 500 },
    model_context_window: 258_400,
  },
  rate_limits: {
    primary: { used_percent: 41.5, window_minutes: 300, resets_at: 1_900_000_000 },
    secondary: { used_percent: 12, window_minutes: 10_080, resets_in_seconds: 3600 },
  },
});

describe('Codex token_count lines', () => {
  it('reads the context, the cache and both windows', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    expect(codexTokenCount(count, now)).toEqual([
      {
        contextTokens: 12_500,
        contextWindow: 258_400,
        cache: { read: 9_000, write: 3_000, ttlMs: null },
      },
      {
        limit: {
          key: 'five_hour',
          label: '5-hour limit',
          used: 0.415,
          resetsAt: new Date(1_900_000_000_000).toISOString(),
        },
      },
      {
        limit: {
          key: 'seven_day',
          label: 'Weekly limit',
          used: 0.12,
          resetsAt: new Date(now + 3_600_000).toISOString(),
        },
      },
    ]);
  });

  it('ignores other lines, broken lines and a count without figures', () => {
    expect(codexTokenCount('not json')).toEqual([]);
    expect(codexTokenCount(line({ type: 'task_started' }))).toEqual([]);
    expect(codexTokenCount(line({ type: 'token_count', info: null, rate_limits: null }))).toEqual(
      [],
    );
  });

  it('names a window by its length', () => {
    const odd = line({
      type: 'token_count',
      rate_limits: { primary: { used_percent: 150, window_minutes: 60 } },
    });
    expect(codexTokenCount(odd)).toEqual([
      { limit: { key: 'w60', label: '1-hour limit', used: 1, resetsAt: null } },
    ]);
  });
});

describe('finding the thread rollout', () => {
  it('reads the last count from the thread file under CODEX_HOME', async () => {
    const home = await mkdtemp(join(tmpdir(), 'deck-codex-'));
    try {
      const dir = join(home, 'sessions', '2026', '11', '12');
      await mkdir(dir, { recursive: true });
      const older = line({
        type: 'token_count',
        info: { last_token_usage: { input_tokens: 1, output_tokens: 1 } },
      });
      await writeFile(join(dir, 'rollout-2026-11-12T01-00-00-abc.jsonl'), `${older}\n${count}\n`);
      await writeFile(join(dir, 'rollout-2026-11-12T02-00-00-other.jsonl'), `${older}\n`);
      const found = await codexUsage({ CODEX_HOME: home }, 'abc');
      expect(found[0]).toMatchObject({ contextTokens: 12_500, contextWindow: 258_400 });
      expect(found).toHaveLength(3);
      expect(await codexUsage({ CODEX_HOME: home }, 'missing')).toEqual([]);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
