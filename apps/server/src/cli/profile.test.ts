import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { addProfile, parseProfileArgs } from './profileCommand.js';

describe('clideck profile add', () => {
  it('parses flags and rejects bad input', () => {
    expect(
      parseProfileArgs(['work', 'claude', '--key-env', 'WORK_KEY', '--label', 'Work']),
    ).toEqual({
      id: 'work',
      base: 'claude',
      label: 'Work',
      keyEnv: 'WORK_KEY',
    });
    expect(typeof parseProfileArgs(['Bad Id', 'claude'])).toBe('string');
    expect(typeof parseProfileArgs(['x', 'gemini'])).toBe('string');
  });

  it('writes the entry, replacing one with the same id and keeping other settings', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'deck-profile-'));
    const env = { DECK_CONFIG_DIR: dir };
    const request = { id: 'work', base: 'claude', label: null, keyEnv: 'WORK_KEY' } as const;
    await addProfile(request, env);
    await addProfile({ ...request, keyEnv: null }, env);
    const saved: unknown = JSON.parse(await readFile(join(dir, 'config.json'), 'utf8'));
    expect(saved).toEqual({ providers: [{ id: 'work', label: 'work', base: 'claude' }] });
  });
});
