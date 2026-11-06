import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fieldVars, fillText } from '@deck/shared';
import type { ProviderRegistry } from '../../domain/provider.js';
import { ProfileService } from '../../application/ProfileService.js';
import { TemplateService } from '../../application/TemplateService.js';
import { JsonProfileStore } from '../store/JsonProfileStore.js';
import { FileTemplateStore } from '../store/FileTemplateStore.js';
import { BUILTIN_TEMPLATES } from './builtinTemplates.js';
import type { ProviderStatusResolver } from './status.js';
import { createTemplateProvider } from './templateProvider.js';
import { profileBundles, type ProfileBundles } from './profileBundle.js';

interface Deps {
  configDir: string;
  providers: ProviderRegistry;
  status: ProviderStatusResolver;
  defaultShell: string;
}

/** Loads templates and saved profiles, keeping the registry and install status in sync when they change. */
export async function createProfileService(deps: Deps): Promise<{
  profiles: ProfileService;
  templates: TemplateService;
  profileBundles: ProfileBundles;
}> {
  const profilesDir = join(deps.configDir, 'profiles');
  const reserved = deps.providers.list().map((p) => p.id);
  const templates: TemplateService = new TemplateService({
    store: new FileTemplateStore(join(deps.configDir, 'templates')),
    builtin: BUILTIN_TEMPLATES,
    inUse: (id) => profiles.usesTemplate(id),
  });
  await templates.load();
  const profiles: ProfileService = new ProfileService({
    store: new JsonProfileStore(join(deps.configDir, 'profiles.json')),
    template: (id) => templates.get(id),
    reservedIds: () => reserved,
    wipeData: async (id) => {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) return;
      await rm(join(profilesDir, id), { recursive: true, force: true });
    },
    unregister: (id) => {
      deps.providers.remove(id);
      deps.status.unregister(id);
    },
    register: (profile) => {
      const template = templates.get(profile.base);
      if (!template) return; // its template was removed: the profile stays on disk but cannot start
      deps.providers.add(createTemplateProvider(profile, template, profilesDir));
      if (template.install) deps.status.alias(profile.id, template.install);
      else {
        const command = fillText(template.command, fieldVars(template, profile.values)).trim();
        deps.status.register({ id: profile.id, command: command || deps.defaultShell });
      }
    },
  });
  await profiles.load();
  return {
    profiles,
    templates,
    profileBundles: profileBundles({ profilesDir, profiles, templates }),
  };
}
