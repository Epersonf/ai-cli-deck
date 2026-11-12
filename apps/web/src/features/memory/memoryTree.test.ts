import { MEMORY_LIMITS, type MemoryEntry, type MemoryFolder } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import {
  briefingUsed,
  buildTree,
  canMoveFolder,
  countNotes,
  flatFolders,
  pathOf,
  subtreeIds,
} from './memoryTree';

const folder = (id: string, parentId: string | null, name = id): MemoryFolder => ({
  id,
  scope: 'global',
  profileId: null,
  name,
  parentId,
});
const note = (id: string, folderId: string | null, body = '', enabled = true): MemoryEntry => ({
  id,
  scope: 'global',
  profileId: null,
  folderId,
  title: id,
  body,
  enabled,
  source: 'user',
  importedFrom: null,
  createdAt: '',
  updatedAt: '',
});

const folders = [folder('a', null), folder('b', 'a'), folder('c', 'b'), folder('z', null)];

describe('memory tree', () => {
  it('nests folders and puts notes in their folder', () => {
    const tree = buildTree(folders, [note('n1', null), note('n2', 'b'), note('n3', 'a')]);
    expect(tree.folders.map((f) => f.folder.id)).toEqual(['a', 'z']);
    expect(tree.entries.map((e) => e.id)).toEqual(['n1']);
    expect(tree.folders[0]?.folders[0]?.entries.map((e) => e.id)).toEqual(['n2']);
  });

  it('gives paths, subtrees and note counts', () => {
    expect(pathOf(folders, 'c').map((f) => f.id)).toEqual(['a', 'b', 'c']);
    expect(pathOf(folders, null)).toEqual([]);
    expect(subtreeIds(folders, 'a').sort()).toEqual(['a', 'b', 'c']);
    expect(countNotes(folders, [note('n', 'c'), note('m', 'z')], 'a')).toBe(1);
  });

  it('refuses to move a folder into itself or its children', () => {
    expect(canMoveFolder(folders, 'a', 'a')).toEqual({ ok: false, reason: 'self' });
    expect(canMoveFolder(folders, 'a', 'c')).toEqual({ ok: false, reason: 'child' });
    expect(canMoveFolder(folders, 'c', 'z')).toEqual({ ok: true });
    expect(canMoveFolder(folders, 'c', null)).toEqual({ ok: true });
  });

  it('refuses a move that makes the tree too deep', () => {
    const deep: MemoryFolder[] = [];
    for (let i = 0; i < MEMORY_LIMITS.depth; i += 1) {
      deep.push(folder(`d${i}`, i === 0 ? null : `d${i - 1}`));
    }
    const all = [...deep, folder('x', null)];
    expect(canMoveFolder(all, 'x', `d${MEMORY_LIMITS.depth - 1}`)).toEqual({
      ok: false,
      reason: 'depth',
    });
    expect(canMoveFolder(all, 'x', 'd0')).toEqual({ ok: true });
  });

  it('counts only enabled notes against the briefing', () => {
    expect(briefingUsed([note('ab', null, 'xyz'), note('off', null, 'long text', false)])).toBe(5);
  });

  it('lists folders indented for a picker', () => {
    expect(flatFolders(folders).map((x) => `${x.depth}${x.folder.id}`)).toEqual([
      '0a',
      '1b',
      '2c',
      '0z',
    ]);
  });
});
