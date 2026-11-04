import { spawn } from 'node:child_process';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { askSecret } from './secretPrompt.js';

export interface EnsureKey {
  /** Environment variable the wrapped CLI reads its key from. */
  envName: string;
  /** What to call the key when asking for it. */
  label: string;
  /** When set, the key is remembered in that folder's `settings.json` (the CLI's own config). */
  saveDir: string | null;
  /** The program to start once the key is available, with its arguments. */
  command: string[];
}

/** Parses `<ENV> "<label>" [--save <dir>] -- <command...>`; returns an error message when malformed. */
export function parseEnsureKey(args: readonly string[]): EnsureKey | string {
  const usage = 'usage: clideck ensure-key <ENV> "<label>" [--save <dir>] -- <command> [args...]';
  const split = args.indexOf('--');
  if (split < 0) return usage;
  const [envName, label, ...flags] = args.slice(0, split);
  const command = args.slice(split + 1);
  if (!envName || !label || command.length === 0) return usage;
  const at = flags.indexOf('--save');
  const saveDir = at >= 0 ? (flags[at + 1] ?? null) : null;
  if (at >= 0 && saveDir === null) return usage;
  return { envName, label, saveDir, command };
}

const settingsFile = (dir: string): string => join(dir, 'settings.json');

type Settings = { env?: Record<string, string> } & Record<string, unknown>;

async function readSettings(dir: string): Promise<Settings> {
  let text: string;
  try {
    text = await readFile(settingsFile(dir), 'utf8');
  } catch {
    return {};
  }
  // Never overwrite a settings file we cannot understand: it may hold the user's own setup.
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    throw new Error(`${settingsFile(dir)} is not a JSON object`);
  return parsed as Settings;
}

/** True when the key is already in the environment or saved in the CLI's settings. */
export async function hasKey(
  { envName, saveDir }: Pick<EnsureKey, 'envName' | 'saveDir'>,
  env: NodeJS.ProcessEnv,
): Promise<boolean> {
  if ((env[envName] ?? '') !== '') return true;
  if (saveDir === null) return false;
  return ((await readSettings(saveDir)).env?.[envName] ?? '') !== '';
}

/** Writes the key into `<dir>/settings.json` under "env", keeping everything else that is there. */
export async function saveKey(dir: string, envName: string, key: string): Promise<void> {
  const settings = await readSettings(dir);
  settings.env = { ...settings.env, [envName]: key };
  await mkdir(dir, { recursive: true });
  const file = settingsFile(dir);
  await writeFile(file, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
  await chmod(file, 0o600).catch(() => undefined);
}

/**
 * Starts a CLI that needs an API key: asks for the key in this terminal when it is missing (nothing
 * is echoed), optionally remembers it in the CLI's own config, then runs the CLI and returns its exit code.
 * The deck itself never stores the key.
 */
export async function ensureKey(
  options: EnsureKey,
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  const [program = '', ...args] = options.command;
  const childEnv = { ...env };
  try {
    if (!(await hasKey(options, env))) {
      console.log(
        `${options.label} is needed to start. It is typed here, hidden, and goes only to the CLI.`,
      );
      const key = await askSecret(`${options.label}: `);
      if (key === '') {
        console.error('No key entered. Close this terminal and open it again to retry.');
        return 1;
      }
      childEnv[options.envName] = key;
      if (options.saveDir !== null) {
        await saveKey(options.saveDir, options.envName, key);
        console.log(
          `Saved in ${settingsFile(options.saveDir)} (only this terminal profile uses it).`,
        );
      }
    }
  } catch (error) {
    console.error(`clideck: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  return new Promise((resolve) => {
    const child = spawn(program, args, { stdio: 'inherit', env: childEnv });
    child.on('error', () => {
      console.error(`clideck: could not start "${program}". Is it installed?`);
      resolve(127);
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}
