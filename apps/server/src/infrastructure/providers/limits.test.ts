import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { codexLimits } from '../agents/codexLimits.js';
import { fakeQuery } from '../agents/fakeClaude.js';
import { claudeLimits } from './claudeLimits.js';

describe('Claude plan limits', () => {
  it('are the windows /usage lists, as fractions with their reset time', async () => {
    const fake = fakeQuery();
    fake.api.usageAnswer = {
      rate_limits_available: true,
      rate_limits: {
        five_hour: { utilization: 42, resets_at: '2026-11-14T20:00:00Z' },
        seven_day: { utilization: 130, resets_at: null },
        seven_day_opus: null,
        seven_day_sonnet: { utilization: null, resets_at: null },
      },
    };
    expect(await claudeLimits(fake.queryFn, {})).toEqual([
      { key: 'five_hour', label: '5-hour limit', used: 0.42, resetsAt: '2026-11-14T20:00:00Z' },
      { key: 'seven_day', label: 'Weekly limit', used: 1, resetsAt: null },
    ]);
  });

  it('are none for an account without plan limits', async () => {
    const fake = fakeQuery();
    expect(await claudeLimits(fake.queryFn, {})).toEqual([]);
  });
});

const count = (used: number): string =>
  JSON.stringify({
    type: 'event_msg',
    payload: {
      type: 'token_count',
      rate_limits: {
        primary: { used_percent: used, window_minutes: 300, resets_at: 1_900_000_000 },
      },
    },
  });

describe('Codex account limits', () => {
  it('are the last ones any chat of the profile wrote, newest chat first', async () => {
    const home = await mkdtemp(join(tmpdir(), 'deck-codex-limits-'));
    try {
      const day = join(home, 'sessions', '2026', '11', '12');
      const later = join(home, 'sessions', '2026', '11', '13');
      await mkdir(day, { recursive: true });
      await mkdir(later, { recursive: true });
      await writeFile(join(day, 'rollout-2026-11-12T01-00-00-a.jsonl'), `${count(10)}\n`);
      await writeFile(join(later, 'rollout-2026-11-13T01-00-00-b.jsonl'), 'no counts here\n');
      await writeFile(join(later, 'rollout-2026-11-13T02-00-00-c.jsonl'), `${count(55)}\n`);
      const found = await codexLimits({ CODEX_HOME: home });
      expect(found).toMatchObject([{ key: 'five_hour', used: 0.55 }]);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it('are none when there are no chats yet', async () => {
    expect(await codexLimits({ CODEX_HOME: join(tmpdir(), 'deck-no-codex-here') })).toEqual([]);
  });
});
