import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProviderPlugins } from './registry.js';
import { runPluginCommand } from './process.js';
import { stringEnv } from '../config/stringEnv.js';

/** Run exactly the tests declared by the package, with the same host runner for every provider. */
export async function testPlugin(
  plugins: ProviderPlugins,
  id: string,
): Promise<{ code: number; output: string }> {
  const plugin = plugins.get(id);
  if (!plugin) throw new Error('Plugin not found');
  if (!plugin.manifest.tests.length) throw new Error('This plugin declares no internal tests');
  const dir = await mkdtemp(join(tmpdir(), 'deck-plugin-tests-'));
  const config = join(dir, 'vitest.config.mjs');
  try {
    await writeFile(
      config,
      `export default ${JSON.stringify({ test: { include: plugin.manifest.tests, maxWorkers: 2, testTimeout: 30000 } })};\n`,
    );
    const runner = fileURLToPath(
      new URL('../../../../../node_modules/vitest/vitest.mjs', import.meta.url),
    );
    return await runPluginCommand(
      [process.execPath, runner, 'run', '--config', config, '--root', plugin.root],
      stringEnv(),
      300_000,
      plugin.root,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
