import { describe, expect, it } from 'vitest';
import { ProfileService } from './ProfileService.js';
import { BUILTIN_TEMPLATES } from '../infrastructure/providers/builtinTemplates.js';

describe('profile creation with a failing plugin', () => {
  it('leaves no persisted profile, reservation or private key after plugin registration fails', async () => {
    const wiped: string[] = [];
    const unregistered: string[] = [];
    let saved = false;
    const service = new ProfileService({
      template: (id) => BUILTIN_TEMPLATES.find((template) => template.id === id),
      store: {
        load: async () => [],
        save: async () => {
          saved = true;
        },
      },
      register: () => {
        throw new Error('Broken plugin factory');
      },
      unregister: (id) => {
        unregistered.push(id);
      },
      reservedIds: () => [],
      saveSecret: async () => undefined,
      wipeData: async (id) => {
        wiped.push(id);
      },
    });
    await expect(
      service.create({ label: 'Broken', base: 'claude', secret: 'private-key' }),
    ).rejects.toThrow('Broken plugin factory');
    expect(saved).toBe(false);
    expect(service.list()).toEqual([]);
    expect(unregistered).toEqual(['broken']);
    expect(wiped).toEqual(['broken', 'broken']);
    expect(service.usesTemplate('claude')).toBe(false);
  });
});
