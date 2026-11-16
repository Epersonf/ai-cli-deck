import { execFile } from 'node:child_process';
import type { ModelListing } from '../../domain/provider.js';
import { antigravityCommand } from './engine/antigravityRpc.js';
import { cleanOutput } from '../../application/loginOutput.js';

/** `agy models` prints a slug and a display name, separated by two or more spaces. */
export function parseAntigravityModels(text: string): ModelListing['choices'] {
  const choices = new Map<string, ModelListing['choices'][number]>();
  for (const line of cleanOutput(text).split('\n')) {
    const row = /^\s*([\w][\w.-]*)\s{2,}(\S.*)\s*$/.exec(line);
    if (!row?.[1] || !row[2] || /^(model|id|slug)$/i.test(row[1])) continue;
    choices.set(row[1], { id: row[1], label: row[2].trim(), description: null });
  }
  return [...choices.values()];
}

/** Query the account's catalog without sending a model prompt or inventing a default. */
export function antigravityModels(env: Record<string, string>): Promise<ModelListing> {
  const fullEnv = { ...process.env, ...env } as Record<string, string>;
  return new Promise((resolve) => {
    execFile(
      antigravityCommand(fullEnv),
      ['models'],
      {
        env: fullEnv,
        timeout: 20_000,
        maxBuffer: 1_000_000,
        windowsHide: true,
      },
      (error, stdout) =>
        resolve({ choices: error ? [] : parseAntigravityModels(stdout), current: null }),
    );
  });
}
