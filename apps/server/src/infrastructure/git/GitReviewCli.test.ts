import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GitReviewCli } from './GitReviewCli.js';
import { runGit } from './gitRun.js';
import { parseBranch, parsePorcelainZ } from './porcelain.js';

describe('porcelain parsing', () => {
  it('reads branch, ahead count, renames and odd names', () => {
    expect(parseBranch('main...origin/main [ahead 2]')).toEqual({ branch: 'main', ahead: 2 });
    expect(parseBranch('main...origin/main')).toEqual({ branch: 'main', ahead: 0 });
    expect(parseBranch('main')).toEqual({ branch: 'main', ahead: null });
    expect(parseBranch('No commits yet on dev')).toEqual({ branch: 'dev', ahead: null });
    const parsed = parsePorcelainZ('## main\0R  new name.ts\0old.ts\0?? a b\0 M x\0');
    expect(parsed.changes).toEqual([
      { code: 'R ', path: 'new name.ts', from: 'old.ts' },
      { code: '??', path: 'a b' },
      { code: ' M', path: 'x' },
    ]);
  });
});

describe('GitReviewCli on a real repository', () => {
  const git = new GitReviewCli(runGit);
  let dir = '';
  const run = (...args: string[]) => runGit(args, dir);
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'deck-git-'));
    await run('init', '-q', '-b', 'main');
    await run('config', 'user.email', 't@t');
    await run('config', 'user.name', 't');
    await run('config', 'core.autocrlf', 'false');
    await writeFile(join(dir, 'a.txt'), 'one\n');
    await writeFile(join(dir, 'b.txt'), 'keep\n');
    await run('add', '.');
    await run('commit', '-q', '-m', 'init');
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('lists, diffs, discards and commits exactly the chosen changes', async () => {
    await writeFile(join(dir, 'a.txt'), 'two\n');
    await writeFile(join(dir, 'b.txt'), 'changed\n');
    await writeFile(join(dir, 'new.txt'), 'hello\n');
    const root = (await git.root(dir)) ?? '';
    const { changes } = await git.status(root);
    expect(changes.map((c) => `${c.code}|${c.path}`)).toEqual([
      ' M|a.txt',
      ' M|b.txt',
      '??|new.txt',
    ]);

    const a = await git.diff(root, { code: ' M', path: 'a.txt' });
    expect(a.diff).toContain('-one');
    expect(a.diff).toContain('+two');
    expect((await git.diff(root, { code: '??', path: 'new.txt' })).diff).toContain('+hello');

    await git.discard(root, { code: ' M', path: 'b.txt' });
    expect(await readFile(join(dir, 'b.txt'), 'utf8')).toBe('keep\n');

    const summary = await git.commit(root, 'pick two', [
      { code: ' M', path: 'a.txt' },
      { code: '??', path: 'new.txt' },
    ]);
    expect(summary).toContain('pick two');
    expect((await git.status(root)).changes).toEqual([]);
  });

  it('discards a new file, and fails with git’s own message', async () => {
    await writeFile(join(dir, 'tmp.txt'), 'x');
    await git.discard(dir, { code: '??', path: 'tmp.txt' });
    expect((await git.status(dir)).changes).toEqual([]);
    await expect(git.push(dir)).rejects.toThrow(/push|remote|destination/i);
  });
});
