import { readFile, readdir } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ProviderPluginManifestSchema,
  type ProfileTemplate,
  type TemplateInfo,
} from '@deck/shared';
import type { PluginContext, PluginHooks, PluginRuntime } from '../../domain/providerPlugin.js';

import { bundledManifests } from './manifests.js';

/** Bundled and imported providers use the same manifest and factory contract. */
export class ProviderPlugins {
  private readonly packages = new Map<string, PluginRuntime>();
  constructor(readonly dir: string) {}
  async load(): Promise<void> {
    for (const plugin of bundledManifests()) await this.loadDirectory(plugin.root, true);
    for (const entry of await readdir(this.dir, { withFileTypes: true }).catch(() => [])) {
      if (!entry.isDirectory() || !/^[a-z0-9][a-z0-9-]*$/.test(entry.name)) continue;
      await this.loadDirectory(join(this.dir, entry.name), false);
    }
  }
  async loadDirectory(root: string, builtin: boolean): Promise<PluginRuntime> {
    const manifest = ProviderPluginManifestSchema.parse(
      JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8')),
    );
    if (this.get(manifest.template.id)?.builtin && !builtin)
      throw new Error('A plugin cannot replace a bundled provider');
    const entry = resolve(root, manifest.entry);
    if (!entry.startsWith(resolve(root) + sep))
      throw new Error('Plugin entry is outside its package');
    const module = (await import(/* @vite-ignore */ pathToFileURL(entry).href)) as {
      default?: (ctx: PluginContext) => PluginHooks;
    };
    if (typeof module.default !== 'function')
      throw new Error('A plugin must export a default factory');
    const runtime: PluginRuntime = { manifest, builtin, root, create: module.default };
    this.packages.set(manifest.template.id, runtime);
    return runtime;
  }
  get(id: string): PluginRuntime | undefined {
    return this.packages.get(id);
  }
  list(): TemplateInfo[] {
    return [...this.packages.values()].map((plugin) => ({
      ...plugin.manifest.template,
      builtin: plugin.builtin,
      plugin: { version: plugin.manifest.version, hasTests: plugin.manifest.tests.length > 0 },
    }));
  }
  templates(): ProfileTemplate[] {
    return this.list();
  }
  forget(id: string): void {
    this.packages.delete(id);
  }
}
