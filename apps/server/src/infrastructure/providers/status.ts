import { access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { posix, win32 } from 'node:path';
import type { ProviderInfo, SetupSpec } from '@deck/shared';
import type { ProviderSecrets } from '../../domain/provider.js';
import { pathKey } from '../config/platform.js';

type Env = Readonly<Record<string, string | undefined>>;
export type ProviderStatusInfo = Pick<ProviderInfo, 'status' | 'hint' | 'canSetup'>;

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

const READY: ProviderStatusInfo = { status: 'ready', hint: null, canSetup: false };
const keyOf = (spec: SetupSpec, secrets: ProviderSecrets): string | null => {
  switch (spec.apiKey?.name) {
    case 'anthropic':
      return secrets.anthropicApiKey;
    case 'openai':
      return secrets.openaiApiKey;
    case 'deepseek':
      return secrets.deepseekApiKey;
    default:
      return null;
  }
};

/** Tells the UI whether a provider's CLI is installed and (as far as we can tell) signed in. */
export class ProviderStatusResolver {
  constructor(
    private readonly specs: readonly SetupSpec[],
    private readonly configured: readonly { id: string; command: string }[],
    private readonly secrets: () => ProviderSecrets,
    private readonly deps: StatusDeps,
  ) {}

  async resolve(id: string): Promise<ProviderStatusInfo> {
    const def = this.configured.find((d) => d.id === id);
    if (def) {
      return (await findExecutable(def.command, this.deps))
        ? READY
        : { status: 'missing', hint: `"${def.command}" was not found in PATH`, canSetup: false };
    }
    const spec = this.specs.find((s) => s.id === id);
    return spec ? this.forSpec(spec) : READY;
  }

  private async forSpec(spec: SetupSpec): Promise<ProviderStatusInfo> {
    if (!(await findExecutable(spec.binary, this.deps))) {
      return { status: 'missing', hint: `${spec.binary} is not installed`, canSetup: true };
    }
    if (await this.signedIn(spec)) return { ...READY, canSetup: true };
    const hint =
      spec.accountLogin === null
        ? 'No API key saved yet'
        : 'No login found (you may already be signed in)';
    return { status: 'unauthenticated', hint, canSetup: true };
  }

  private async signedIn(spec: SetupSpec): Promise<boolean> {
    if (keyOf(spec, this.secrets()) !== null) return true;
    const envVar = spec.apiKey?.envVar;
    if (envVar !== undefined && this.deps.env[envVar]) return true;
    for (const file of spec.credentialFiles) {
      if (await this.deps.exists(posix.join(this.deps.home, file))) return true;
    }
    return false;
  }
}
