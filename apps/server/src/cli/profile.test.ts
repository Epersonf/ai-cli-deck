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
      baseUrl: '',
    });
    expect(parseProfileArgs(['Mine', 'custom', '--command', 'aider'])).toMatchObject({
      command: 'aider',
    });
    expect(typeof parseProfileArgs(['x', 'gemini'])).toBe('string');
    expect(typeof parseProfileArgs([])).toBe('string');
  });

  it('a custom endpoint needs its URL, and only it takes one', () => {
    const url = 'https://llm.example.com/anthropic';
    expect(parseProfileArgs(['Corp', 'claude-endpoint', '--url', url])).toMatchObject({
      base: 'claude-endpoint',
      baseUrl: url,
    });
    expect(typeof parseProfileArgs(['Corp', 'claude-endpoint'])).toBe('string');
    expect(typeof parseProfileArgs(['Corp', 'claude-endpoint', '--url', 'nope'])).toBe('string');
    expect(typeof parseProfileArgs(['Corp', 'claude', '--url', url])).toBe('string');
  });

  it('stores a clean profile with a unique id and no credentials', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'deck-profile-'));
    const env = { DECK_CONFIG_DIR: dir };
    await addProfile({ label: 'Work', base: 'claude', command: '', baseUrl: '' }, env);
    await addProfile({ label: 'Work', base: 'codex', command: '', baseUrl: '' }, env);
    const saved: unknown = JSON.parse(await readFile(join(dir, 'profiles.json'), 'utf8'));
    expect(saved).toEqual([
      { id: 'work', label: 'Work', base: 'claude', command: '', baseUrl: '' },
      { id: 'work-2', label: 'Work', base: 'codex', command: '', baseUrl: '' },
    ]);
  });
});
