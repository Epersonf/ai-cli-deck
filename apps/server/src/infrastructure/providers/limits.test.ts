import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { codexLimits, parseRateLimits } from '../agents/codexLimits.js';
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

describe('Codex account limits', () => {
  const answer = {
    rateLimits: {
      primary: { usedPercent: 100, windowDurationMins: 300, resetsAt: 1_900_000_000 },
      secondary: { usedPercent: 16, windowDurationMins: 10_080, resetsAt: null },
    },
  };

  it('are the two windows of the main bucket, as fractions', () => {
    expect(parseRateLimits(answer)).toEqual([
      {
        key: 'five_hour',
        label: '5-hour limit',
        used: 1,
        resetsAt: new Date(1_900_000_000_000).toISOString(),
      },
      { key: 'seven_day', label: 'Weekly limit', used: 0.16, resetsAt: null },
    ]);
    expect(parseRateLimits({ rateLimits: { primary: null } })).toEqual([]);
    expect(parseRateLimits(null)).toEqual([]);
  });

  it('come from the Codex app server, which is asked and then stopped', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'deck-codex-bin-'));
    try {
      const script = `#!/usr/bin/env node
require('readline').createInterface({ input: process.stdin }).on('line', (l) => {
  const m = JSON.parse(l);
  if (m.method === 'account/rateLimits/read')
    console.log(JSON.stringify({ id: m.id, result: ${JSON.stringify(answer)} }));
});
`;
      await writeFile(join(dir, 'codex'), script, { mode: 0o755 });
      const found = await codexLimits({ PATH: `${dir}:${process.env['PATH'] ?? ''}` });
      expect(found.map((l) => [l.key, l.used])).toEqual([
        ['five_hour', 1],
        ['seven_day', 0.16],
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 20_000);

  it('are none when Codex cannot be started', async () => {
    expect(await codexLimits({ PATH: join(tmpdir(), 'deck-no-codex-here') })).toEqual([]);
  });
});
