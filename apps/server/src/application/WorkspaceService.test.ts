import { describe, expect, it } from 'vitest';
import type { FilesPort, GitPort } from '../domain/ports.js';
import { WorkspaceService } from './WorkspaceService.js';

const entry = (name: string, kind: 'file' | 'dir' = 'file') => ({ name, path: name, kind });

function setup(ignoredByGit: string[]) {
  const files: FilesPort = {
    list: () =>
      Promise.resolve([
        entry('src', 'dir'),
        entry('dist', 'dir'),
        entry('.git', 'dir'),
        entry('a.ts'),
      ]),
    read: () => Promise.reject(new Error('unused')),
    resolveFile: () => Promise.reject(new Error('unused')),
  };
  const git: GitPort = {
    status: () => Promise.reject(new Error('unused')),
    ignoredPaths: (_cwd, paths) =>
      Promise.resolve(new Set(paths.filter((p) => ignoredByGit.includes(p)))),
  };
  const sessions = { get: () => ({ cwd: '/w' }) as never };
  return new WorkspaceService({ sessions, files, git });
}

describe('WorkspaceService.tree', () => {
  it('marks git-ignored entries and keeps them visible', async () => {
    const tree = await setup(['dist']).tree('s1', '', false);
    expect(tree.map((e) => [e.name, e.ignored])).toEqual([
      ['dist', true],
      ['src', false],
      ['a.ts', false],
    ]);
  });

  it('marks .git as ignored when internals are shown', async () => {
    const tree = await setup([]).tree('s1', '', true);
    expect(tree.find((e) => e.name === '.git')?.ignored).toBe(true);
  });
});
