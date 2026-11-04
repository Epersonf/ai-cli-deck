import type { Profile } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import { ProfileService } from './ProfileService.js';

function setup(reserved: string[] = ['claude']) {
  const saved: Profile[][] = [];
  const registered: Profile[] = [];
  const removed: string[] = [];
  const wiped: string[] = [];
  const service = new ProfileService({
    store: { load: () => Promise.resolve([]), save: (p) => (saved.push(p), Promise.resolve()) },
    register: (p) => registered.push(p),
    unregister: (id) => void removed.push(id),
    reservedIds: () => reserved,
    wipeData: (id) => (wiped.push(id), Promise.resolve()),
  });
  return { service, saved, registered, removed, wiped };
}

describe('ProfileService custom endpoint', () => {
  it('requires an http(s) URL for the endpoint base', async () => {
    const { service } = setup([]);
    await expect(
      service.create({ label: 'Corp', base: 'claude-endpoint', command: '', baseUrl: '' }),
    ).rejects.toThrow(/base URL/);
    const ok = await service.create({
      label: 'Corp',
      base: 'claude-endpoint',
      command: '',
      baseUrl: 'https://llm.example.com',
    });
    expect(ok.baseUrl).toBe('https://llm.example.com');
  });
});

describe('ProfileService data erasure', () => {
  it('wipes the folder before a new profile starts, so a reused name never inherits a login', async () => {
    const { service, wiped } = setup([]);
    const first = await service.create({ label: 'Work', base: 'claude', command: '' });
    expect(wiped).toEqual([first.id]);
    await service.remove(first.id);
    await service.purgeData(first.id);
    const again = await service.create({ label: 'Work', base: 'claude', command: '' });
    expect(again.id).toBe(first.id);
    expect(wiped).toEqual([first.id, first.id, first.id]);
  });

  it('refuses to purge a profile that still exists', async () => {
    const { service } = setup([]);
    const p = await service.create({ label: 'Keep', base: 'claude', command: '' });
    await expect(service.purgeData(p.id)).rejects.toThrow();
  });
});

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
