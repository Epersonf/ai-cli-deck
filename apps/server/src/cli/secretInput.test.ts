import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { saveApiKey } from './apiKeyStore.js';
import { EMPTY_SECRET, applySecretInput } from './secretInput.js';

const type = (...chunks: string[]) => chunks.reduce(applySecretInput, EMPTY_SECRET);

describe('applySecretInput', () => {
  it('collects typed characters until Enter', () => {
    expect(type('sk-', 'abc')).toMatchObject({ buffer: 'sk-abc', done: false });
    expect(type('sk-abc\r')).toMatchObject({ buffer: 'sk-abc', done: true, cancelled: false });
  });

  it('handles backspace and pasted text with a trailing newline', () => {
    expect(type('abcd', '\x7f', '\x7f').buffer).toBe('ab');
    expect(type('pasted-key\n')).toMatchObject({ buffer: 'pasted-key', done: true });
  });

  it('cancels on Ctrl+C or Ctrl+D without keeping going', () => {
    expect(type('abc\x03')).toMatchObject({ done: true, cancelled: true });
    expect(type('\x04')).toMatchObject({ done: true, cancelled: true });
  });
});

describe('saveApiKey', () => {
  it('writes a private config and keeps existing settings and keys', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'deck-keys-'));
    await writeFile(
      join(dir, 'config.json'),
      JSON.stringify({ port: 9000, apiKeys: { openai: 'o' } }),
    );
    const file = await saveApiKey(dir, 'anthropic', 'sk-ant');
    const saved = JSON.parse(await readFile(file, 'utf8'));
    expect(saved).toEqual({ port: 9000, apiKeys: { openai: 'o', anthropic: 'sk-ant' } });
    if (process.platform !== 'win32') expect((await stat(file)).mode & 0o777).toBe(0o600);
  });

  it('creates the file when missing and refuses to overwrite invalid JSON', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'deck-keys-'));
    await saveApiKey(dir, 'deepseek', 'k');
    expect(JSON.parse(await readFile(join(dir, 'config.json'), 'utf8'))).toEqual({
      apiKeys: { deepseek: 'k' },
    });
    await writeFile(join(dir, 'config.json'), '{ not json');
    await expect(saveApiKey(dir, 'openai', 'x')).rejects.toThrow();
    expect(await readFile(join(dir, 'config.json'), 'utf8')).toBe('{ not json');
  });
});
