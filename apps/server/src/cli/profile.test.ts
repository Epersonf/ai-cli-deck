import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { addProfile, parseProfileArgs } from './profileCommand.js';

describe('clideck profile add', () => {
  it('parses the name and base, and rejects bad input', () => {
    expect(parseProfileArgs(['Work', 'claude'])).toEqual({
      label: 'Work',
      base: 'claude',
      command: '',
    });
    expect(parseProfileArgs(['Mine', 'custom', '--command', 'aider'])).toMatchObject({
      command: 'aider',
    });
    expect(typeof parseProfileArgs(['x', 'gemini'])).toBe('string');
    expect(typeof parseProfileArgs([])).toBe('string');
  });

  it('stores a clean profile with a unique id and no credentials', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'deck-profile-'));
    const env = { DECK_CONFIG_DIR: dir };
    await addProfile({ label: 'Work', base: 'claude', command: '' }, env);
    await addProfile({ label: 'Work', base: 'codex', command: '' }, env);
    const saved: unknown = JSON.parse(await readFile(join(dir, 'profiles.json'), 'utf8'));
    expect(saved).toEqual([
      { id: 'work', label: 'Work', base: 'claude', command: '' },
      { id: 'work-2', label: 'Work', base: 'codex', command: '' },
    ]);
  });
});
