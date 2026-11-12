import { MEMORY_LIMITS } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import { EventBus, type DeckEvent } from '../domain/events.js';
import { FakeMemoryStore, fakeMemory } from '../testing/memoryKit.js';

function setup() {
  const bus = new EventBus();
  const events: DeckEvent[] = [];
  bus.subscribe((e) => events.push(e));
  const store = new FakeMemoryStore();
  return { memory: fakeMemory(bus, store), store, events };
}
const mem = (events: DeckEvent[]) => events.filter((e) => e.kind === 'memory');

describe('memory notes', () => {
  it('are kept per scope, saved at once, and announced', async () => {
    const { memory, store, events } = setup();
    const g = await memory.notes.create({ scope: 'global', title: ' Tabs ', body: 'spaces' });
    const p = await memory.notes.create({
      scope: 'profile',
      profileId: 'claude',
      title: 'Stack',
      body: 'pnpm',
    });
    expect(g).toMatchObject({ title: 'Tabs', profileId: null, source: 'user', enabled: true });
    expect(memory.tree('global').entries).toHaveLength(1);
    expect(memory.tree('profile', 'claude').entries[0]?.id).toBe(p.id);
    expect(memory.tree('profile', 'codex').entries).toEqual([]);
    expect([...store.files.keys()].sort()).toEqual(['global', 'profile:claude']);
    expect(mem(events)).toEqual([
      { kind: 'memory', scope: 'global', profileId: null },
      { kind: 'memory', scope: 'profile', profileId: 'claude' },
    ]);
    expect(memory.entry(p.id)?.scope).toBe('profile');
  });

  it('are edited, disabled, moved to a folder and deleted; ids work across scopes', async () => {
    const { memory } = setup();
    const folder = await memory.folders.create({
      scope: 'profile',
      profileId: 'claude',
      name: 'Work',
    });
    const note = await memory.notes.create({
      scope: 'profile',
      profileId: 'claude',
      title: 'a',
      body: 'b',
    });
    const edited = await memory.notes.update(note.id, {
      body: 'c',
      enabled: false,
      folderId: folder.id,
    });
    expect(edited).toMatchObject({ body: 'c', enabled: false, folderId: folder.id });
    await expect(memory.notes.update(note.id, { folderId: 'nope' })).rejects.toThrow(/not found/);
    await memory.notes.delete(note.id);
    expect(memory.entry(note.id)).toBeUndefined();
    await expect(memory.notes.delete(note.id)).rejects.toThrow(/not found/);
  });

  it('refuse a profile note without a profile and too many notes', async () => {
    const { memory } = setup();
    await expect(
      Promise.resolve().then(() => memory.notes.create({ scope: 'profile', title: 'a' })),
    ).rejects.toThrow(/profile/);
    for (let i = 0; i < MEMORY_LIMITS.perScope; i += 1)
      await memory.notes.create({ scope: 'global', title: `n${i}`, body: '' });
    await expect(memory.notes.create({ scope: 'global', title: 'one more' })).rejects.toThrow(
      /At most/,
    );
  });

  it('go away with their folder, and a profile takes its memory with it', async () => {
    const { memory, store } = setup();
    const f = await memory.folders.create({ scope: 'profile', profileId: 'p1', name: 'F' });
    await memory.notes.create({
      scope: 'profile',
      profileId: 'p1',
      folderId: f.id,
      title: 'in',
      body: '',
    });
    await memory.notes.create({ scope: 'profile', profileId: 'p1', title: 'out', body: '' });
    await memory.folders.delete(f.id);
    expect(memory.tree('profile', 'p1').entries.map((e) => e.title)).toEqual(['out']);
    await memory.dropProfile('p1');
    expect(store.files.has('profile:p1')).toBe(false);
    expect(memory.tree('profile', 'p1').entries).toEqual([]);
  });

  it('come back after a restart', async () => {
    const first = setup();
    await first.memory.notes.create({ scope: 'global', title: 'kept', body: 'yes' });
    const second = fakeMemory(new EventBus(), first.store);
    await second.restore();
    expect(second.tree('global').entries[0]?.title).toBe('kept');
  });
});
