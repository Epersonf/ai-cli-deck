import { mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProviderRegistry } from '../../domain/provider.js';
import { ProfileService } from '../../application/ProfileService.js';
import { TemplateService } from '../../application/TemplateService.js';
import { JsonProfileStore } from '../store/JsonProfileStore.js';
import { FileTemplateStore } from '../store/FileTemplateStore.js';
import { ProviderPlugins } from '../plugins/registry.js';
import { withPlugin } from '../plugins/provider.js';
import { BUILTIN_TEMPLATES } from './builtinTemplates.js';
import type { ProviderStatusResolver } from './status.js';
import { createTemplateProvider } from './templateProvider.js';
import { writeSecret } from './profileSecret.js';
import { profileBundles, type ProfileBundles } from './profileBundle.js';

interface Deps {
  configDir: string;
  providers: ProviderRegistry;
  status: ProviderStatusResolver;
}

/** Some CLIs (Codex) refuse to start when their home folder does not exist yet. */
function ensureHome(dir: string): void {
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // the CLI will report the real problem when it starts
  }
}

/** Loads templates and saved profiles, keeping the registry and install status in sync when they change. */
export async function createProfileService(deps: Deps): Promise<{
  profiles: ProfileService;
  templates: TemplateService;
  profileBundles: ProfileBundles;
  providerPlugins: ProviderPlugins;
}> {
  const profilesDir = join(deps.configDir, 'profiles');
  const providerPlugins = new ProviderPlugins(join(deps.configDir, 'plugins'));
  await providerPlugins.load();
  for (const provider of deps.providers.list()) {
    const plugin = providerPlugins.get(provider.id);
    if (!plugin) continue;
    const configured = withPlugin(
      provider,
      { id: provider.id, label: provider.label, base: provider.id, values: {} },
      join(profilesDir, provider.id),
      plugin,
    );
    deps.providers.add(configured);
    if (configured.setup) deps.status.registerPlugin(provider.id, configured.setup);
  }
  const reserved = deps.providers.list().map((p) => p.id);
  const templates: TemplateService = new TemplateService({
    store: new FileTemplateStore(join(deps.configDir, 'templates')),
    builtin: BUILTIN_TEMPLATES,
    plugins: providerPlugins,
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
    saveSecret: async (id, secret) => {
      ensureHome(join(profilesDir, id));
      await writeSecret(join(profilesDir, id), secret);
    },
    unregister: (id) => {
      deps.providers.remove(id);
      deps.status.unregister(id);
    },
    register: (profile) => {
      const template = templates.get(profile.base);
      if (!template) return; // its template was removed: the profile stays on disk but cannot start
      if (template.home) ensureHome(join(profilesDir, profile.id));
      const base = createTemplateProvider(profile, template, profilesDir);
      const plugin = providerPlugins.get(profile.base) ?? providerPlugins.get(template.agent);
      const provider = plugin
        ? withPlugin(base, profile, join(profilesDir, profile.id), plugin)
        : base;
      deps.providers.add(provider);
      if (provider.setup) deps.status.registerPlugin(profile.id, provider.setup);
      deps.status.alias(profile.id, template.install ?? template.agent);
    },
  });
  await profiles.load();
  return {
    profiles,
    templates,
    providerPlugins,
    profileBundles: profileBundles({ profilesDir, profiles, templates }),
  };
}
