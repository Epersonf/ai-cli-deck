import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Profile } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import type { ProfileService } from '../../application/ProfileService.js';
import type { TemplateService } from '../../application/TemplateService.js';
import { profileBundles } from './profileBundle.js';

const work: Profile = { id: 'work', label: 'Work', base: 'claude', values: {} };

async function device(profiles: Profile[]) {
  const profilesDir = await mkdtemp(join(tmpdir(), 'deck-profiles-'));
  const adopted: Profile[] = [];
  const bundles = profileBundles({
    profilesDir,
    profiles: {
      list: () => profiles,
      adopt: async (p: Profile) => (adopted.push(p), p),
    } as unknown as ProfileService,
    templates: {
      list: () => [{ id: 'claude', builtin: true }],
      get: () => ({ id: 'claude' }),
    } as unknown as TemplateService,
  });
  return { profilesDir, bundles, adopted };
}

describe('moving a profile to another device', () => {
  it('carries its sign-in and settings, and leaves its chats behind unless asked', async () => {
    const phone = await device([work]);
    const home = join(phone.profilesDir, 'work');
    await mkdir(join(home, 'projects', 'p'), { recursive: true });
    await writeFile(join(home, 'settings.json'), '{"env":{"ANTHROPIC_API_KEY":"k"}}');
    await writeFile(join(home, '.credentials.json'), '{"token":"t"}');
    await writeFile(join(home, 'projects', 'p', 'chat.jsonl'), '{}');

    const bundle = await phone.bundles.pack('work', false);
    expect(bundle.files.map((f) => f.path).sort()).toEqual(['.credentials.json', 'settings.json']);
    expect((await phone.bundles.pack('work', true)).files).toHaveLength(3);

    const pc = await device([]);
    expect(await pc.bundles.unpack(bundle)).toEqual(work);
    expect(pc.adopted).toEqual([work]);
    expect(await readFile(join(pc.profilesDir, 'work', 'settings.json'), 'utf8')).toContain('"k"');
  });

  it('refuses a bundle that writes outside the profile folder', async () => {
    const pc = await device([]);
    const evil = { profile: work, template: null, files: [{ path: '../../x', data: '' }] };
    await expect(pc.bundles.unpack(evil)).rejects.toThrow('Bad path');
  });
});
