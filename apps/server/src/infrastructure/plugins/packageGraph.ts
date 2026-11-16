import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import type { PluginRuntime } from '../../domain/providerPlugin.js';

const SOURCE_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const isCode = (file: string): boolean => /\.(?:ts|tsx|mjs|js)$/.test(file);
export async function pluginFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  for (const item of await readdir(root, { withFileTypes: true })) {
    if (item.name === 'node_modules' || item.name === '.git' || item.isSymbolicLink()) continue;
    const file = join(root, item.name);
    if (item.isDirectory()) files.push(...(await pluginFiles(file)));
    else if (item.isFile()) files.push(file);
  }
  return files;
}

/** Export runtime dependencies, internal tests and their fixtures as a portable module graph. */
export async function packageGraph(plugin: PluginRuntime): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  const queued = new Set<string>();
  const entry = resolve(plugin.root, plugin.manifest.entry);
  const destination = (file: string): string => {
    const path = file.startsWith(SOURCE_ROOT)
      ? relative(SOURCE_ROOT, file)
      : relative(plugin.root, file);
    if (path.startsWith('..')) throw new Error('Plugin dependency is outside its package');
    return `runtime/${path.replaceAll('\\', '/').replace(/\.(?:ts|tsx|js)$/, '.mjs')}`;
  };
  const visit = async (file: string): Promise<void> => {
    if (queued.has(file)) return;
    queued.add(file);
    let raw: Buffer;
    try {
      raw = await readFile(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EISDIR') throw error;
      for (const child of await pluginFiles(file)) await visit(child);
      return;
    }
    if (!isCode(file)) {
      files.set(destination(file), raw);
      return;
    }
    let code =
      extname(file) === '.ts' || extname(file) === '.tsx'
        ? transpileModule(raw.toString(), {
            compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 },
          }).outputText
        : raw.toString();
    const refs = [
      ...code.matchAll(/((?:from\s+|import\(|mock\(|new URL\()\s*)(['"])(\.[^'"\n]+)\2/g),
    ];
    for (const ref of refs) {
      const specifier = ref[3];
      if (!specifier) continue;
      let target = resolve(dirname(file), specifier);
      if (target.endsWith('.js')) {
        try {
          await readFile(target);
        } catch {
          target = target.slice(0, -3) + '.ts';
        }
      }
      await visit(target);
      let path = relative(dirname(destination(file)), destination(target)).replaceAll('\\', '/');
      if (!path.startsWith('.')) path = './' + path;
      code = code.replace(ref[0], `${ref[1]}${ref[2]}${path}${ref[2]}`);
    }
    files.set(destination(file), Buffer.from(code));
  };
  for (const file of await pluginFiles(plugin.root))
    if (file !== join(plugin.root, 'manifest.json')) await visit(file);
  const manifest = {
    ...plugin.manifest,
    entry: destination(entry),
    tests: plugin.manifest.tests.map(
      (pattern) =>
        `${destination(plugin.root).replace(/\/$/, '')}/${pattern.replace(/\.(?:ts|tsx|js)$/, '.mjs')}`,
    ),
  };
  files.set('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));
  files.set(
    'vitest.config.mjs',
    Buffer.from(
      `export default ${JSON.stringify({ test: { include: manifest.tests, maxWorkers: 2, testTimeout: 30000 } })};\n`,
    ),
  );
  return files;
}
