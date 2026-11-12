import { createRequire } from 'node:module';
import { access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { posix, win32 } from 'node:path';
import type { ProviderInfo, SetupSpec } from '@deck/shared';
import { pathKey } from '../config/platform.js';

type Env = Readonly<Record<string, string | undefined>>;
export type ProviderStatusInfo = Pick<ProviderInfo, 'status' | 'hint' | 'canInstall' | 'setupId'>;

export interface StatusDeps {
  env: Env;
  home: string;
  platform: NodeJS.Platform;
  exists(path: string): Promise<boolean>;
  /** True when the Claude Agent SDK ships its own Claude Code for this platform (no `claude` needed). */
  sdkBinary(): boolean;
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
  sdkBinary: () => {
    const require = createRequire(import.meta.url);
    const base = `@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}`;
    return [base, `${base}-musl`].some((name) => {
      try {
        require.resolve(`${name}/package.json`);
        return true;
      } catch {
        return false;
      }
    });
  },
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

const READY: ProviderStatusInfo = { status: 'ready', hint: null, canInstall: false, setupId: null };

/** Tells the UI whether an agent can run: Claude Code ships inside the SDK, Codex must be in PATH. */
export class ProviderStatusResolver {
  constructor(
    private readonly specs: readonly SetupSpec[],
    private readonly deps: StatusDeps,
  ) {}

  private readonly aliases = new Map<string, string>();

  /** Profiles of a built-in CLI are installed/missing exactly like that CLI. */
  alias(id: string, baseId: string): void {
    this.aliases.set(id, baseId);
  }

  unregister(id: string): void {
    this.aliases.delete(id);
  }

  async resolve(id: string): Promise<ProviderStatusInfo> {
    const spec = this.specs.find((s) => s.id === (this.aliases.get(id) ?? id));
    if (!spec) return READY;
    if (spec.id === 'claude' && this.deps.sdkBinary()) return READY;
    if (await findExecutable(spec.binary, this.deps)) return READY;
    return {
      status: 'missing',
      hint: `${spec.binary} is not installed`,
      canInstall: spec.install !== null,
      setupId: spec.id,
    };
  }
}
