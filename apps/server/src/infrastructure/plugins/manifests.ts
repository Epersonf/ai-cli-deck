import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProviderPluginManifestSchema } from '@deck/shared';

export const BUILTIN_PLUGIN_ROOT = fileURLToPath(new URL('../../plugins/', import.meta.url));
/** Discover bundled packages without executing their entry points. */
export function bundledManifests() {
  return readdirSync(BUILTIN_PLUGIN_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      root: join(BUILTIN_PLUGIN_ROOT, entry.name),
      manifest: ProviderPluginManifestSchema.parse(
        JSON.parse(readFileSync(join(BUILTIN_PLUGIN_ROOT, entry.name, 'manifest.json'), 'utf8')),
      ),
    }))
    .sort((a, b) => a.manifest.order - b.manifest.order);
}
