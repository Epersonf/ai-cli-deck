import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listDirs } from './listDirs.js';

let home = '';
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'deck-dirs-'));
  for (const name of ['beta', 'Alpha', '.hidden']) await mkdir(join(home, name));
  await mkdir(join(home, 'Alpha', 'inner'));
  await writeFile(join(home, 'file.txt'), 'x');
});
afterEach(() => rm(home, { recursive: true, force: true }));

describe('listing folders for the picker', () => {
  it('lists only sub-folders, sorted, hidden last, with parent, home and roots', async () => {
    const out = await listDirs('', home);
    expect(out.path).toBe(home);
    expect(out.dirs.map((d) => d.name)).toEqual(['Alpha', 'beta', '.hidden']);
    expect(out.dirs[0]?.path).toBe(join(home, 'Alpha'));
    expect(out.home).toBe(home);
    expect(out.parent).not.toBeNull();
    expect(out.roots.length).toBeGreaterThan(0);
    const inner = await listDirs(join(home, 'Alpha'), home);
    expect(inner.dirs.map((d) => d.name)).toEqual(['inner']);
    expect(inner.parent).toBe(home);
  });

  it('understands ~, refuses relative paths and NUL, and reports a missing or non-folder path', async () => {
    expect((await listDirs('~/Alpha', home)).path).toBe(join(home, 'Alpha'));
    await expect(listDirs('relative/path', home)).rejects.toThrow(/absolute/);
    await expect(listDirs('/tmp/a\0b', home)).rejects.toThrow(/Invalid/);
    await expect(listDirs(join(home, 'nope'), home)).rejects.toThrow(/not found/);
    await expect(listDirs(join(home, 'file.txt'), home)).rejects.toThrow(/not a folder/);
  });

  it('has no parent at a root, and caps very long lists', async () => {
    const root = (await listDirs('', home)).roots[0]?.path ?? '/';
    expect((await listDirs(root, home)).parent).toBeNull();
    for (let i = 0; i < 520; i += 1) await mkdir(join(home, `d${String(i).padStart(3, '0')}`));
    expect((await listDirs(home, home)).dirs).toHaveLength(500);
  });
});
