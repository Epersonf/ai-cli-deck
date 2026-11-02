import { access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { posix, win32 } from 'node:path';
import type { ProviderInfo, SetupSpec } from '@deck/shared';
import { pathKey } from '../config/platform.js';

type Env = Readonly<Record<string, string | undefined>>;
export type ProviderStatusInfo = Pick<ProviderInfo, 'status' | 'hint' | 'canInstall'>;

export interface StatusDeps {
  env: Env;
  home: string;
  platform: NodeJS.Platform;
  exists(path: string): Promise<boolean>;
}

export const realStatusDeps = (): StatusDeps => ({
  env: process.env,
  home: homedir(),
  platform: process.platform,
  exists: (path) =>
    access(path).then(
      () => true,
      () => false,
    ),
});

/** True when `name` resolves to a file in PATH (honours PATHEXT on Windows). */
export async function findExecutable(name: string, deps: StatusDeps): Promise<boolean> {
  if (/[\\/]/.test(name)) return deps.exists(name);
  const windows = deps.platform === 'win32';
  const path = windows ? win32 : posix;
  const dirs = (deps.env[pathKey(deps.env)] ?? '').split(path.delimiter).filter(Boolean);
  const exts = windows ? (deps.env['PATHEXT'] ?? '.EXE;.CMD;.BAT').split(';') : [''];
  for (const dir of dirs) {
    for (const ext of exts) if (await deps.exists(path.join(dir, name + ext))) return true;
  }
  return false;
}

const READY: ProviderStatusInfo = { status: 'ready', hint: null, canInstall: false };

/** Tells the UI whether a provider's CLI is installed. Sign-in is the CLI's own flow. */
export class ProviderStatusResolver {
  constructor(
    private readonly specs: readonly SetupSpec[],
    private readonly configured: { id: string; command: string }[],
    private readonly deps: StatusDeps,
  ) {}

  register(entry: { id: string; command: string }): void {
    const at = this.configured.findIndex((d) => d.id === entry.id);
    if (at >= 0) this.configured.splice(at, 1);
    this.configured.push(entry);
  }

  async resolve(id: string): Promise<ProviderStatusInfo> {
    const def = this.configured.find((d) => d.id === id);
    if (def) {
      return (await findExecutable(def.command, this.deps))
        ? READY
        : { status: 'missing', hint: `"${def.command}" was not found in PATH`, canInstall: false };
    }
    const spec = this.specs.find((s) => s.id === id);
    if (!spec || (await findExecutable(spec.binary, this.deps))) return READY;
    return {
      status: 'missing',
      hint: `${spec.binary} is not installed`,
      canInstall: spec.install !== null,
    };
  }
}
