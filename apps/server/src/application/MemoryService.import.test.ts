import { describe, expect, it } from 'vitest';
import { EventBus } from '../domain/events.js';
import { fakeMemory } from '../testing/memoryKit.js';

const setup = () => ({ memory: fakeMemory(new EventBus()) });

describe('importing notes', () => {
  async function seeded() {
    const s = setup();
    const f = await s.memory.folders.create({ scope: 'profile', profileId: 'a', name: 'Work' });
    const sub = await s.memory.folders.create({
      scope: 'profile',
      profileId: 'a',
      name: 'Deep',
      parentId: f.id,
    });
    const one = await s.memory.notes.create({
      scope: 'profile',
      profileId: 'a',
      folderId: f.id,
      title: 'one',
      body: '1',
    });
    await s.memory.notes.create({
      scope: 'profile',
      profileId: 'a',
      folderId: sub.id,
      title: 'two',
      body: '2',
    });
    const loose = await s.memory.notes.create({
      scope: 'profile',
      profileId: 'a',
      title: 'loose',
      body: 'x',
    });
    return { ...s, f, one, loose };
  }

  it('copies chosen notes and whole folders with their structure, marked as imports', async () => {
    const { memory, f, loose } = await seeded();
    const tree = await memory.importNotes({
      fromProfile: 'a',
      toProfile: 'b',
      ids: [loose.id],
      folderIds: [f.id],
    });
    expect(tree.folders.map((x) => x.name).sort()).toEqual(['Deep', 'Work']);
    expect(tree.entries.map((e) => e.title).sort()).toEqual(['loose', 'one', 'two']);
    expect(
      tree.entries.every(
        (e) => e.source === 'import' && e.importedFrom === 'a' && e.profileId === 'b',
      ),
    ).toBe(true);
    expect(memory.tree('profile', 'a').entries).toHaveLength(3);
  });

  it('skips exact duplicates, merges same-named folders, and refuses nonsense', async () => {
    const { memory, f, one } = await seeded();
    await memory.importNotes({ fromProfile: 'a', toProfile: 'b', ids: [one.id], folderIds: [] });
    const again = await memory.importNotes({
      fromProfile: 'a',
      toProfile: 'b',
      ids: [],
      folderIds: [f.id],
    });
    expect(again.entries.map((e) => e.title).sort()).toEqual(['one', 'two']);
    expect(again.folders.filter((x) => x.name === 'Work')).toHaveLength(1);
    await expect(
      memory.importNotes({ fromProfile: 'a', toProfile: 'a', ids: [], folderIds: [] }),
    ).rejects.toThrow(/another profile/);
    await expect(
      memory.importNotes({ fromProfile: 'a', toProfile: 'b', ids: ['zzz'], folderIds: [] }),
    ).rejects.toThrow(/not found/);
  });
});
