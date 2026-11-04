import { describe, expect, it } from 'vitest';
import { customBody, createHarness } from '../testing/harness.js';
import { BUILTIN_TEMPLATES } from '../infrastructure/providers/builtinTemplates.js';
import { ProfileService } from './ProfileService.js';
import type { SessionManager } from './SessionManager.js';
import { removeProfile } from './removeProfile.js';

describe('removeProfile', () => {
  it('ends the profile terminals and keeps the others', async () => {
    const h = createHarness();
    const wiped: string[] = [];
    const profiles = new ProfileService({
      template: (id) => BUILTIN_TEMPLATES.find((t) => t.id === id),
      store: { load: () => Promise.resolve([]), save: () => Promise.resolve() },
      register: () => undefined,
      unregister: () => undefined,
      reservedIds: () => [],
      wipeData: (id) => (wiped.push(id), Promise.resolve()),
    });
    await profiles.create({ label: 'Custom', base: 'custom' });
    const mine = await h.sessions.create({ ...customBody(), provider: 'custom' });
    const other = await h.sessions.create({ ...customBody(), provider: 'shell' });
    const result = await removeProfile({ profiles, sessions: h.sessions }, 'custom');
    expect(result.ended).toBe(1);
    expect(h.sessions.get(mine.id)).toBeUndefined();
    expect(h.sessions.get(other.id)).toBeDefined();
    expect(profiles.has('custom')).toBe(false);
    expect(wiped).toContain('custom');
  });

  it('still deletes the profile when a terminal refuses to end', async () => {
    const wiped: string[] = [];
    const profiles = new ProfileService({
      template: (id) => BUILTIN_TEMPLATES.find((t) => t.id === id),
      store: { load: () => Promise.resolve([]), save: () => Promise.resolve() },
      register: () => undefined,
      unregister: () => undefined,
      reservedIds: () => [],
      wipeData: (id) => (wiped.push(id), Promise.resolve()),
    });
    await profiles.create({ label: 'Custom', base: 'custom' });
    const stuck = {
      list: () => [
        { id: 'a', provider: 'custom' },
        { id: 'b', provider: 'custom' },
      ],
      remove: (id: string) => (id === 'a' ? Promise.reject(new Error('boom')) : Promise.resolve()),
    } as unknown as SessionManager;
    const result = await removeProfile({ profiles, sessions: stuck }, 'custom');
    expect(result.ended).toBe(1);
    expect(profiles.has('custom')).toBe(false);
    expect(wiped).toContain('custom');
  });
});
