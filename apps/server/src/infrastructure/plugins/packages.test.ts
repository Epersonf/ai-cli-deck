import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ProviderPlugins } from './registry.js';
import { inspectPluginArchive } from './archive.js';
import { exportPlugin, installPlugin, removePlugin } from './packages.js';
import { collectEntries, zipStream } from '../fs/zipStream.js';

const dirs: string[] = [];
async function dir() {
  const path = await mkdtemp(join(tmpdir(), 'deck-package-'));
  dirs.push(path);
  return path;
}
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});
async function zip(root: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of zipStream(await collectEntries(root, '')))
    chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks);
}
async function sample() {
  const root = await dir();
  await writeFile(
    join(root, 'manifest.json'),
    JSON.stringify({
      plugin: 1,
      version: '1.0.0',
      entry: 'index.mjs',
      template: { schema: 1, id: 'sample', label: 'Sample', agent: 'codex' },
      tests: ['**/*.test.mjs'],
    }),
  );
  await writeFile(
    join(root, 'index.mjs'),
    'export default () => ({ installed: async () => true, install: async () => ({ok:true,output:"ok"}), login: () => {throw Error("no account")}, auth: async () => ({state:"signed-out",via:null,account:null}), logout: async () => {} });',
  );
  await writeFile(
    join(root, 'internal.test.mjs'),
    'import {it,expect} from "vitest"; it("packaged test",()=>expect(2+2).toBe(4));',
  );
  return root;
}

describe('portable provider packages', () => {
  it('inspects, imports, exports with tests and reloads without installing a CLI', async () => {
    const source = await sample();
    const original = await zip(source);
    expect(inspectPluginArchive(original).manifest.template.id).toBe('sample');
    const registry = new ProviderPlugins(await dir());
    expect(await installPlugin(registry, original, () => false)).toBe('sample');
    const exported = await exportPlugin(registry, 'sample');
    const archive = inspectPluginArchive(Buffer.from(exported.data, 'base64'));
    expect(archive.manifest.entry).toMatch(/\.mjs$/);
    expect([...archive.files.keys()].some((path) => path.endsWith('internal.test.mjs'))).toBe(true);
    const other = new ProviderPlugins(await dir());
    await installPlugin(other, Buffer.from(exported.data, 'base64'), () => false);
    expect(other.get('sample')?.create).toBeTypeOf('function');
    await removePlugin(other, 'sample', () => false);
    expect(other.get('sample')).toBeUndefined();
  });
  it('refuses replacing an in-use plugin and incomplete packages', async () => {
    const registry = new ProviderPlugins(await dir());
    const original = await zip(await sample());
    await expect(installPlugin(registry, original, () => true)).rejects.toThrow(/Profiles use/);
    const empty = await dir();
    await mkdir(join(empty, 'empty'));
    expect(() => inspectPluginArchive(Buffer.from('broken'))).toThrow();
    expect(() => inspectPluginArchive(Buffer.alloc(22))).toThrow(/ZIP/);
    await expect(zip(empty).then(inspectPluginArchive)).rejects.toThrow(/manifest/);
  });
  it('includes Codex optimizations and its internal tests in a real exported package', async () => {
    const registry = new ProviderPlugins(await dir());
    await registry.load();
    const result = await exportPlugin(registry, 'codex');
    const archive = inspectPluginArchive(Buffer.from(result.data, 'base64'));
    const names = [...archive.files.keys()];
    expect(names.some((name) => name.endsWith('codexCompact.test.mjs'))).toBe(true);
    expect(names.some((name) => name.endsWith('codexCapabilities.test.mjs'))).toBe(true);
    expect(names.some((name) => name.endsWith('codexRun.test.mjs'))).toBe(true);
    expect(
      [...archive.files.values()].some((contents) => contents.includes('tool_output_token_limit')),
    ).toBe(true);
    expect(archive.manifest.features.cacheIdleRiskMs).toBe(3600000);
  }, 30000);
  it.each([
    '../outside.mjs',
    '.. /outside.mjs',
    '/outside.mjs',
    'C:/outside.mjs',
    'node_modules/override.mjs',
  ])('rejects unsafe archive entry %s', async (name) => {
    const root = await sample();
    const chunks: Buffer[] = [];
    for await (const chunk of zipStream([
      { path: join(root, 'index.mjs'), name, mtime: new Date() },
    ]))
      chunks.push(Buffer.from(chunk as Uint8Array));
    expect(() => inspectPluginArchive(Buffer.concat(chunks))).toThrow(/Unsafe plugin path/);
  });
});
