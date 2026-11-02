import { delimiter } from 'node:path';

type Env = Readonly<Record<string, string | undefined>>;

/** The platform's default interactive shell. */
export function defaultShell(env: Env, platform: NodeJS.Platform): string {
  if (platform === 'win32') return env['COMSPEC'] ?? 'cmd.exe';
  return env['SHELL'] ?? 'bash';
}

/** Windows spells the variable `Path`; everywhere else it is `PATH`. */
export function pathKey(env: Env): string {
  return Object.keys(env).find((key) => key.toUpperCase() === 'PATH') ?? 'PATH';
}

export function prependToPath(env: Env, dir: string): { key: string; value: string } {
  const key = pathKey(env);
  const inherited = env[key];
  return { key, value: inherited ? `${dir}${delimiter}${inherited}` : dir };
}
