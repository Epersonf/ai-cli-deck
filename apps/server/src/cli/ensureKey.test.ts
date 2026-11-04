import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasKey, parseEnsureKey, saveKey } from './ensureKey.js';

const folder = (): Promise<string> => mkdtemp(join(tmpdir(), 'ensure-key-'));

describe('parseEnsureKey', () => {
  it('splits the key settings from the command', () => {
    expect(parseEnsureKey(['TOKEN', 'My key', '--save', '/cfg', '--', 'claude', '-x'])).toEqual({
      envName: 'TOKEN',
      label: 'My key',
      saveDir: '/cfg',
      command: ['claude', '-x'],
    });
    expect(parseEnsureKey(['TOKEN', 'My key', '--', 'claude'])).toMatchObject({ saveDir: null });
  });

  it('rejects a missing command, missing separator or dangling --save', () => {
    expect(parseEnsureKey(['TOKEN', 'My key'])).toMatch(/usage/);
    expect(parseEnsureKey(['TOKEN', 'My key', '--'])).toMatch(/usage/);
    expect(parseEnsureKey(['TOKEN', 'My key', '--save', '--', 'claude'])).toMatch(/usage/);
  });
});

describe('saved keys', () => {
  it('keeps the user settings that are already there', async () => {
    const dir = await folder();
    await writeFile(join(dir, 'settings.json'), JSON.stringify({ theme: 'dark', env: { A: '1' } }));
    await saveKey(dir, 'TOKEN', 'sk-123');
    expect(JSON.parse(await readFile(join(dir, 'settings.json'), 'utf8'))).toEqual({
      theme: 'dark',
      env: { A: '1', TOKEN: 'sk-123' },
    });
  });

  it('finds a key from the environment or from the saved settings', async () => {
    const dir = await folder();
    const target = { envName: 'TOKEN', saveDir: dir };
    expect(await hasKey(target, {})).toBe(false);
    expect(await hasKey(target, { TOKEN: 'from-env' })).toBe(true);
    await saveKey(dir, 'TOKEN', 'sk-123');
    expect(await hasKey(target, {})).toBe(true);
    expect(await hasKey({ envName: 'TOKEN', saveDir: null }, {})).toBe(false);
  });

  it('refuses to overwrite a settings file it cannot read', async () => {
    const dir = await folder();
    await writeFile(join(dir, 'settings.json'), '{ not json');
    await expect(saveKey(dir, 'TOKEN', 'sk-123')).rejects.toThrow();
    expect(await readFile(join(dir, 'settings.json'), 'utf8')).toBe('{ not json');
  });
});
