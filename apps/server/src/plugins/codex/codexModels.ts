import { exec } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ModelListing } from '../../domain/provider.js';

const TIMEOUT_MS = 20_000;

/** Runs the Codex CLI for its catalog; tests give a stand-in. */
export type RunCodex = (args: string[], env: Record<string, string>) => Promise<string>;

export const runCodex: RunCodex = (args, env) =>
  new Promise((resolve, reject) => {
    // The arguments are fixed words, so one command line is safe (and finds codex.cmd on Windows).
    exec(
      ['codex', ...args].join(' '),
      { env: { ...process.env, ...env }, timeout: TIMEOUT_MS, maxBuffer: 8_000_000 },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    );
  });

interface Row {
  slug?: unknown;
  display_name?: unknown;
  description?: unknown;
  visibility?: unknown;
}

/** The models Codex lists for the picker (those it hides are not offered). */
export function parseCatalog(text: string): ModelListing['choices'] {
  const models = (JSON.parse(text) as { models?: Row[] }).models ?? [];
  return models.flatMap((m) =>
    typeof m.slug === 'string' && m.visibility !== 'hide'
      ? [
          {
            id: m.slug,
            label: typeof m.display_name === 'string' && m.display_name ? m.display_name : m.slug,
            description: typeof m.description === 'string' && m.description ? m.description : null,
          },
        ]
      : [],
  );
}

/** The `model = "..."` line at the top level of Codex's config, if the person set one. */
export function configModel(toml: string): string | null {
  for (const line of toml.split(/\r?\n/)) {
    if (/^\s*\[/.test(line)) return null; // tables come after the top-level keys
    const m = /^\s*model\s*=\s*["']([^"']+)["']/.exec(line);
    if (m) return m[1] ?? null;
  }
  return null;
}

/** Codex's catalog (`codex debug models`, else its cache file) and the default from its config. */
export async function codexModels(
  env: Record<string, string>,
  run: RunCodex = runCodex,
): Promise<ModelListing> {
  const home = env['CODEX_HOME'] || process.env['CODEX_HOME'] || join(homedir(), '.codex');
  const choices = await run(['debug', 'models'], env)
    .then(parseCatalog)
    .catch(() => readFile(join(home, 'models_cache.json'), 'utf8').then(parseCatalog))
    .catch(() => []);
  const current = await readFile(join(home, 'config.toml'), 'utf8')
    .then(configModel)
    .catch(() => null);
  return { choices, current };
}
