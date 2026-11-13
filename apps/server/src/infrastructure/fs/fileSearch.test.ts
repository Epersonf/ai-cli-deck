import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FileFinder, listProjectFiles, rankFiles } from './fileSearch.js';

describe('ranking files for an @ mention', () => {
  const files = [
    'src/app.ts',
    'src/ui/AppShell.tsx',
    'README.md',
    'docs/app-notes.md',
    'a/b/c/apple.txt',
  ];

  it('puts exact names, then prefixes, then substrings first', () => {
    expect(rankFiles(files, 'app', 10)).toEqual([
      'src/app.ts',
      'a/b/c/apple.txt',
      'docs/app-notes.md',
      'src/ui/AppShell.tsx',
    ]);
  });

  it('matches paths and loose letters, ignoring case', () => {
    expect(rankFiles(files, 'SRC/ui', 10)).toEqual(['src/ui/AppShell.tsx']);
    expect(rankFiles(files, 'rdm', 10)).toEqual(['README.md']);
    expect(rankFiles(files, 'zzz', 10)).toEqual([]);
  });

  it('lists the shallowest files for an empty query and respects the limit', () => {
    expect(rankFiles(files, '', 2)).toEqual(['README.md', 'docs/app-notes.md']);
  });
});

describe('listing project files', () => {
  let root = '';
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'deck-find-'));
    for (const dir of ['src', 'node_modules/x', '.git', 'dist', '.hidden']) {
      await mkdir(join(root, dir), { recursive: true });
    }
    for (const file of [
      'top.txt',
      'src/a.ts',
      'node_modules/x/i.js',
      '.git/HEAD',
      'dist/o.js',
      '.hidden/h.txt',
      '.env',
    ]) {
      await writeFile(join(root, file), 'x');
    }
  });
  afterAll(() => rm(root, { recursive: true, force: true }));

  it('skips dependencies, build output and hidden files', async () => {
    expect((await listProjectFiles(root)).sort()).toEqual(['src/a.ts', 'top.txt']);
  });

  it('caches the list for a few seconds', async () => {
    let clock = 0;
    const finder = new FileFinder(() => clock);
    expect(await finder.find(root, 'a', 5)).toEqual(['src/a.ts']);
    await writeFile(join(root, 'later.txt'), 'x');
    expect(await finder.find(root, 'later', 5)).toEqual([]);
    clock = 11_000;
    expect(await finder.find(root, 'later', 5)).toEqual(['later.txt']);
  });
});
