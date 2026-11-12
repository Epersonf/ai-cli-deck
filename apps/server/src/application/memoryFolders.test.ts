import { MEMORY_LIMITS, type MemoryFolder, type MemoryTree } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import {
  addFolder,
  changeFolder,
  dropFolder,
  emptyTree,
  findPath,
  folderPath,
} from './memoryFolders.js';

const folder = (id: string, name: string, parentId: string | null): MemoryFolder => ({
  id,
  scope: 'global',
  profileId: null,
  name,
  parentId,
});
const build = (...fs: MemoryFolder[]): MemoryTree =>
  fs.reduce((t, f) => addFolder(t, f), emptyTree());

describe('memory folders', () => {
  it('know their path, and a path finds its folder', () => {
    const t = build(folder('a', 'Work', null), folder('b', 'Notes', 'a'));
    expect(folderPath(t, 'b')).toBe('Work/Notes');
    expect(folderPath(t, null)).toBe('');
    expect(findPath(t, 'work/notes')).toEqual({ id: 'b' });
    expect(findPath(t, '')).toEqual({ id: null });
    expect(findPath(t, 'Work/Nope')).toBeNull();
  });

  it('refuse a twin sibling, too deep a tree and too many folders', () => {
    const t = build(folder('a', 'Work', null));
    expect(() => addFolder(t, folder('x', ' work ', null))).toThrow(/already/);
    let deep = emptyTree();
    for (let i = 0; i < MEMORY_LIMITS.depth; i += 1)
      deep = addFolder(deep, folder(`d${i}`, `n${i}`, i === 0 ? null : `d${i - 1}`));
    expect(() => addFolder(deep, folder('z', 'z', `d${MEMORY_LIMITS.depth - 1}`))).toThrow(/deep/);
    const many: MemoryTree = {
      folders: Array.from({ length: MEMORY_LIMITS.folders }, (_, i) =>
        folder(`f${i}`, `n${i}`, null),
      ),
      entries: [],
    };
    expect(() => addFolder(many, folder('q', 'q', null))).toThrow(/At most/);
  });

  it('move without cycles, and keep the depth of what moves with them', () => {
    const t = build(folder('a', 'A', null), folder('b', 'B', 'a'), folder('c', 'C', 'b'));
    expect(() => changeFolder(t, 'a', { parentId: 'c' })).toThrow(/into itself/);
    expect(() => changeFolder(t, 'a', { parentId: 'a' })).toThrow(/into itself/);
    expect(folderPath(changeFolder(t, 'c', { parentId: null, name: 'Top' }), 'c')).toBe('Top');
    let deep = t;
    for (let i = 0; i < 3; i += 1)
      deep = addFolder(deep, folder(`p${i}`, `p${i}`, i === 0 ? null : `p${i - 1}`));
    expect(() => changeFolder(deep, 'a', { parentId: 'p2' })).toThrow(/deep/);
  });

  it('delete with everything inside', () => {
    const t = {
      ...build(folder('a', 'A', null), folder('b', 'B', 'a'), folder('k', 'K', null)),
      entries: [
        { id: 'e1', folderId: 'b' },
        { id: 'e2', folderId: 'k' },
        { id: 'e3', folderId: null },
      ] as never,
    };
    const next = dropFolder(t, 'a');
    expect(next.folders.map((f) => f.id)).toEqual(['k']);
    expect(next.entries.map((e) => e.id)).toEqual(['e2', 'e3']);
    expect(() => dropFolder(next, 'a')).toThrow(/not found/);
  });
});
