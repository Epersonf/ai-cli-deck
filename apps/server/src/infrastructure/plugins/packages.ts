import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectEntries, zipStream } from '../fs/zipStream.js';
import { inspectPluginArchive } from './archive.js';
import { packageGraph } from './packageGraph.js';
import type { ProviderPlugins } from './registry.js';
export { testPlugin } from './pluginTests.js';

const MODULES = fileURLToPath(new URL('../../../../../node_modules/', import.meta.url));

export async function exportPlugin(
  plugins: ProviderPlugins,
  id: string,
): Promise<{ name: string; data: string }> {
  const plugin = plugins.get(id);
  if (!plugin) throw new Error('Plugin not found');
  const dir = await mkdtemp(join(tmpdir(), 'deck-plugin-export-'));
  try {
    for (const [path, contents] of await packageGraph(plugin)) {
      const target = join(dir, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, contents);
    }
    const chunks: Buffer[] = [];
    for await (const chunk of zipStream(await collectEntries(dir, '')))
      chunks.push(Buffer.from(chunk as Uint8Array));
    return {
      name: `${id}-${plugin.manifest.version}.deck-plugin.zip`,
      data: Buffer.concat(chunks).toString('base64'),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Only called after explicit import confirmation; inspection never imports executable code. */
export async function installPlugin(
  plugins: ProviderPlugins,
  data: Buffer,
  inUse: (id: string) => boolean,
): Promise<string> {
  const archive = inspectPluginArchive(data);
  const id = archive.manifest.template.id;
  const previous = plugins.get(id);
  if (previous?.builtin) throw new Error('Bundled plugins cannot be replaced; choose another id');
  if (inUse(id))
    throw new Error('Profiles use this plugin; remove those profiles before replacing it');
  await mkdir(plugins.dir, { recursive: true });
  const stage = await mkdtemp(join(plugins.dir, '.stage-'));
  const digest = createHash('sha256').update(data).digest('hex').slice(0, 16);
  const target = join(plugins.dir, `${id}-${digest}`);
  try {
    for (const [path, contents] of archive.files) {
      const file = join(stage, path);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, contents, { mode: 0o600 });
    }
    await symlink(
      MODULES,
      join(stage, 'node_modules'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    if (previous?.root === target) return id;
    await rename(stage, target);
    try {
      await plugins.loadDirectory(target, false);
    } catch (error) {
      await rm(target, { recursive: true, force: true });
      throw error;
    }
    if (previous) await rm(previous.root, { recursive: true, force: true });
    return id;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

export async function removePlugin(
  plugins: ProviderPlugins,
  id: string,
  inUse: (id: string) => boolean,
): Promise<void> {
  const plugin = plugins.get(id);
  if (!plugin) throw new Error('Plugin not found');
  if (plugin.builtin || inUse(id))
    throw new Error('Bundled plugins and plugins in use cannot be removed');
  await rm(plugin.root, { recursive: true, force: true });
  plugins.forget(id);
}
