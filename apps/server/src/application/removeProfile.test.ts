import { describe, expect, it } from 'vitest';
import { customBody, createHarness } from '../testing/harness.js';
import { ProfileService } from './ProfileService.js';
import { removeProfile } from './removeProfile.js';

describe('removeProfile', () => {
  it('ends the profile terminals and keeps the others', async () => {
    const h = createHarness();
    const profiles = new ProfileService({
      store: { load: () => Promise.resolve([]), save: () => Promise.resolve() },
      register: () => undefined,
      unregister: () => undefined,
      reservedIds: () => [],
    });
    await profiles.create({ label: 'Custom', base: 'custom', command: '' });
    const mine = await h.sessions.create({ ...customBody(), provider: 'custom' });
    const other = await h.sessions.create({ ...customBody(), provider: 'shell' });
    const result = await removeProfile({ profiles, sessions: h.sessions }, 'custom');
    expect(result.ended).toBe(1);
    expect(h.sessions.get(mine.id)).toBeUndefined();
    expect(h.sessions.get(other.id)).toBeDefined();
    expect(profiles.has('custom')).toBe(false);
  });
});
