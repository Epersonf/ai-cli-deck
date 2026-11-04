import type { Profile } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import { BUILTIN_TEMPLATES } from '../infrastructure/providers/builtinTemplates.js';
import { ProfileService } from './ProfileService.js';

function setup(reserved: string[] = ['claude']) {
  const saved: Profile[][] = [];
  const registered: Profile[] = [];
  const removed: string[] = [];
  const wiped: string[] = [];
  const service = new ProfileService({
    template: (id) => BUILTIN_TEMPLATES.find((t) => t.id === id),
    store: { load: () => Promise.resolve([]), save: (p) => (saved.push(p), Promise.resolve()) },
    register: (p) => registered.push(p),
    unregister: (id) => void removed.push(id),
    reservedIds: () => reserved,
    wipeData: (id) => (wiped.push(id), Promise.resolve()),
  });
  return { service, saved, registered, removed, wiped };
}

describe('ProfileService id collisions', () => {
  it('gives profiles created at the same moment different ids (and so different folders)', async () => {
    const { service, wiped } = setup([]);
    const made = await Promise.all([
      service.create({ label: 'Work!', base: 'claude' }),
      service.create({ label: 'Work?', base: 'claude' }),
      service.create({ label: 'Work', base: 'codex' }),
    ]);
    expect(made.map((p) => p.id)).toEqual(['work', 'work-2', 'work-3']);
    expect(new Set(wiped).size).toBe(3);
  });

  it('knows about a profile another process added to the file, and never reuses its id', async () => {
    const outside: Profile = {
      id: 'work',
      label: 'Work',
      base: 'claude',
      values: {},
    };
    let stored: Profile[] = [];
    const registered: string[] = [];
    const service = new ProfileService({
      template: (id) => BUILTIN_TEMPLATES.find((t) => t.id === id),
      store: {
        load: () => Promise.resolve(stored),
        save: (p) => ((stored = [...p]), Promise.resolve()),
      },
      register: (p) => void registered.push(p.id),
      unregister: () => undefined,
      reservedIds: () => [],
      wipeData: () => Promise.resolve(),
    });
    await service.load();
    stored = [outside]; // `clideck profile add "Work" claude` ran while the deck was up
    const mine = await service.create({ label: 'Work', base: 'claude' });
    expect(mine.id).toBe('work-2');
    expect(registered).toContain('work');
    expect(stored.map((p) => p.id)).toEqual(['work', 'work-2']); // its profile is kept, not overwritten
  });
});

describe('ProfileService custom endpoint', () => {
  it('requires an http(s) URL for the endpoint base', async () => {
    const { service } = setup([]);
    await expect(service.create({ label: 'Corp', base: 'claude-endpoint' })).rejects.toThrow(
      /API base URL/,
    );
    const ok = await service.create({
      label: 'Corp',
      base: 'claude-endpoint',
      values: { baseUrl: 'https://llm.example.com' },
    });
    expect(ok.values['baseUrl']).toBe('https://llm.example.com');
  });
});

describe('ProfileService data erasure', () => {
  it('wipes the folder before a new profile starts, so a reused name never inherits a login', async () => {
    const { service, wiped } = setup([]);
    const first = await service.create({ label: 'Work', base: 'claude' });
    expect(wiped).toEqual([first.id]);
    await service.remove(first.id);
    await service.purgeData(first.id);
    const again = await service.create({ label: 'Work', base: 'claude' });
    expect(again.id).toBe(first.id);
    expect(wiped).toEqual([first.id, first.id, first.id]);
  });

  it('refuses to purge a profile that still exists', async () => {
    const { service } = setup([]);
    const p = await service.create({ label: 'Keep', base: 'claude' });
    await expect(service.purgeData(p.id)).rejects.toThrow();
  });
});

describe('ProfileService', () => {
  it('creates a profile with a unique id and registers it', async () => {
    const { service, saved, registered } = setup();
    const a = await service.create({ label: 'Claude', base: 'claude' });
    const b = await service.create({ label: 'Claude', base: 'claude' });
    expect([a.id, b.id]).toEqual(['claude-2', 'claude-3']);
    expect(saved.at(-1)).toHaveLength(2);
    expect(registered).toHaveLength(2);
  });

  it('renames only the label; id and base stay', async () => {
    const { service } = setup([]);
    const { id } = await service.create({ label: 'Work', base: 'codex' });
    const renamed = await service.rename(id, 'Office');
    expect(renamed).toMatchObject({ id, base: 'codex', label: 'Office' });
    expect(service.list()[0]?.label).toBe('Office');
  });

  it('deletes a profile, unregisters it and persists the rest', async () => {
    const { service, saved, removed } = setup([]);
    const a = await service.create({ label: 'A', base: 'claude' });
    await service.create({ label: 'B', base: 'codex' });
    await service.remove(a.id);
    expect(service.list().map((p) => p.label)).toEqual(['B']);
    expect(saved.at(-1)).toHaveLength(1);
    expect(removed).toEqual([a.id]);
    await expect(service.remove(a.id)).rejects.toThrow('not found');
  });

  it('rejects unknown profiles, unknown templates and fields the template does not have', async () => {
    const { service } = setup();
    await expect(service.rename('ghost', 'x')).rejects.toThrow('not found');
    await expect(service.create({ label: 'A', base: 'nope' })).rejects.toThrow(/template/i);
    await expect(
      service.create({ label: 'A', base: 'claude', values: { command: 'rm' } }),
    ).rejects.toThrow(/Unknown field/);
  });
});
