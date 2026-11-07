import { describe, expect, it } from 'vitest';
import { customBody, createHarness } from '../testing/harness.js';
import { BUILTIN_TEMPLATES } from '../infrastructure/providers/builtinTemplates.js';
import { ProfileService } from './ProfileService.js';
import { removeProfile } from './removeProfile.js';

async function customProfile(wiped: string[]): Promise<ProfileService> {
  const profiles = new ProfileService({
    template: (id) => BUILTIN_TEMPLATES.find((t) => t.id === id),
    store: { load: () => Promise.resolve([]), save: () => Promise.resolve() },
    register: () => undefined,
    unregister: () => undefined,
    reservedIds: () => [],
    wipeData: (id) => (wiped.push(id), Promise.resolve()),
  });
  await profiles.create({ label: 'Custom', base: 'custom' });
  wiped.length = 0;
  return profiles;
}

describe('removeProfile', () => {
  it('refuses while a terminal of the profile is still open', async () => {
    const h = createHarness();
    const wiped: string[] = [];
    const profiles = await customProfile(wiped);
    const mine = await h.sessions.create({ ...customBody(), provider: 'custom' });
    await expect(removeProfile({ profiles, sessions: h.sessions }, 'custom')).rejects.toThrow(
      /Close its 1 terminal/,
    );
    expect(h.sessions.get(mine.id)).toBeDefined();
    expect(profiles.has('custom')).toBe(true);
    expect(wiped).toEqual([]);
  });

  it('with force, ends the profile terminals, keeps the others and deletes the profile', async () => {
    const h = createHarness();
    const wiped: string[] = [];
    const profiles = await customProfile(wiped);
    const mine = await h.sessions.create({ ...customBody(), provider: 'custom' });
    const other = await h.sessions.create({ ...customBody(), provider: 'shell' });
    const result = await removeProfile({ profiles, sessions: h.sessions }, 'custom', true);
    expect(result.ended).toBe(1);
    expect(h.sessions.get(mine.id)).toBeUndefined();
    expect(h.sessions.get(other.id)).toBeDefined();
    expect(profiles.has('custom')).toBe(false);
    expect(wiped).toContain('custom');
  });

  it('deletes the profile and its data once no terminal is left', async () => {
    const h = createHarness();
    const wiped: string[] = [];
    const profiles = await customProfile(wiped);
    const other = await h.sessions.create({ ...customBody(), provider: 'shell' });
    await removeProfile({ profiles, sessions: h.sessions }, 'custom');
    expect(profiles.has('custom')).toBe(false);
    expect(wiped).toContain('custom');
    expect(h.sessions.get(other.id)).toBeDefined();
  });
});
