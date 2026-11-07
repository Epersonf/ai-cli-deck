import type { Runner } from './exec.js';

/**
 * The deck's own environment, free of any profile. The first client starts the tmux server and the server
 * keeps that environment for every session after it, so a session's variables (a DeepSeek model, an API
 * URL) must travel with `-e` only, never in the environment the client starts with.
 */
export const neutralEnv = (): Record<string, string> =>
  Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );

/** Variables of `tmux show-environment -g` that are not the deck's own. */
export function leakedKeys(shown: string, mine: Record<string, string>): string[] {
  const keys: string[] = [];
  for (const line of shown.split('\n')) {
    const at = line.indexOf('=');
    if (at < 1) continue; // blank, or "-NAME": a variable tmux marks as removed
    const key = line.slice(0, at);
    if (mine[key] !== line.slice(at + 1)) keys.push(key);
  }
  return keys;
}

/**
 * A tmux server started by an older deck still carries the first session's profile in its global
 * environment and hands it to every new session. Drops whatever differs from the deck's environment.
 */
export async function dropLeakedEnv(run: Runner, socketArgs: string[]): Promise<string[]> {
  try {
    const shown = await run('tmux', [...socketArgs, 'show-environment', '-g']);
    const leaked = leakedKeys(shown, neutralEnv());
    if (leaked.length === 0) return [];
    const unset = leaked.flatMap((key, i) => [
      ...(i > 0 ? [';'] : []),
      'set-environment',
      '-gu',
      key,
    ]);
    await run('tmux', [...socketArgs, ...unset]);
    return leaked;
  } catch {
    return []; // no server running yet: nothing can leak
  }
}
