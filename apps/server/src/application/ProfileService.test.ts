import type { Profile } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import { ProfileService } from './ProfileService.js';

function setup(reserved: string[] = ['claude']) {
  const saved: Profile[][] = [];
  const registered: Profile[] = [];
  const removed: string[] = [];
  const service = new ProfileService({
    store: { load: () => Promise.resolve([]), save: (p) => (saved.push(p), Promise.resolve()) },
    register: (p) => registered.push(p),
    unregister: (id) => void removed.push(id),
    reservedIds: () => reserved,
  });
  return { service, saved, registered, removed };
}

describe('ProfileService', () => {
  it('creates a profile with a unique id and registers it', async () => {
    const { service, saved, registered } = setup();
    const a = await service.create({ label: 'Claude', base: 'claude', command: '' });
    const b = await service.create({ label: 'Claude', base: 'claude', command: '' });
    expect([a.id, b.id]).toEqual(['claude-2', 'claude-3']);
    expect(saved.at(-1)).toHaveLength(2);
    expect(registered).toHaveLength(2);
  });

  it('renames only the label; id and base stay', async () => {
    const { service } = setup([]);
    const { id } = await service.create({ label: 'Work', base: 'codex', command: '' });
    const renamed = await service.rename(id, 'Office');
    expect(renamed).toMatchObject({ id, base: 'codex', label: 'Office' });
    expect(service.list()[0]?.label).toBe('Office');
  });

  it('deletes a profile, unregisters it and persists the rest', async () => {
    const { service, saved, removed } = setup([]);
    const a = await service.create({ label: 'A', base: 'claude', command: '' });
    await service.create({ label: 'B', base: 'codex', command: '' });
    await service.remove(a.id);
    expect(service.list().map((p) => p.label)).toEqual(['B']);
    expect(saved.at(-1)).toHaveLength(1);
    expect(removed).toEqual([a.id]);
    await expect(service.remove(a.id)).rejects.toThrow('not found');
  });

  it('rejects unknown profiles and commands on non-custom bases', async () => {
    const { service } = setup();
    await expect(service.rename('ghost', 'x')).rejects.toThrow('not found');
    await expect(service.create({ label: 'A', base: 'claude', command: 'rm' })).rejects.toThrow();
  });
});
