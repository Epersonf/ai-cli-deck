import { SETUP_SPECS } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import { ProviderStatusResolver, findExecutable, type StatusDeps } from './status.js';

function deps(
  files: string[],
  env: Record<string, string> = {},
  platform: NodeJS.Platform = 'linux',
): StatusDeps {
  const present = new Set(files);
  return {
    env: { PATH: platform === 'win32' ? 'C:\\bin' : '/usr/bin:/opt/bin', ...env },
    home: '/home/u',
    platform,
    exists: (p) => Promise.resolve(present.has(p)),
    sdkBinary: () => false,
  };
}

describe('findExecutable', () => {
  it('searches every PATH entry', async () => {
    expect(await findExecutable('claude', deps(['/opt/bin/claude']))).toBe(true);
    expect(await findExecutable('claude', deps(['/elsewhere/claude']))).toBe(false);
  });

  it('honours PATHEXT on Windows', async () => {
    const win = deps(['C:\\bin\\claude.CMD'], { PATHEXT: '.EXE;.CMD' }, 'win32');
    expect(await findExecutable('claude', win)).toBe(true);
  });

  it('checks explicit paths directly', async () => {
    expect(await findExecutable('/x/tool', deps(['/x/tool']))).toBe(true);
  });
});

const resolver = (d: StatusDeps) => new ProviderStatusResolver(SETUP_SPECS, d);

describe('ProviderStatusResolver', () => {
  it('treats a profile like its base CLI, so it installs the base', async () => {
    const r = resolver(deps([]));
    r.alias('work', 'claude');
    expect(await r.resolve('work')).toMatchObject({ status: 'missing', setupId: 'claude' });
    r.unregister('work');
    expect((await r.resolve('work')).status).toBe('ready');
  });

  it('only reports whether the CLI is installed, never whether it is signed in', async () => {
    expect(await resolver(deps([])).resolve('claude')).toEqual({
      status: 'missing',
      hint: 'claude is not installed',
      canInstall: true,
      setupId: 'claude',
    });
    expect((await resolver(deps(['/usr/bin/claude'])).resolve('claude')).status).toBe('ready');
    expect((await resolver(deps(['/usr/bin/codex'])).resolve('codex')).status).toBe('ready');
  });

  it('shares the claude binary with the DeepSeek provider', async () => {
    const r = resolver(deps(['/usr/bin/claude']));
    r.alias('claude-deepseek', 'claude');
    expect((await r.resolve('claude-deepseek')).status).toBe('ready');
    const none = resolver(deps([]));
    none.alias('claude-deepseek', 'claude');
    expect((await none.resolve('claude-deepseek')).status).toBe('missing');
  });

  it('needs no claude binary when the SDK ships its own, but codex must be installed', async () => {
    const bundled = { ...deps([]), sdkBinary: () => true };
    expect((await resolver(bundled).resolve('claude')).status).toBe('ready');
    expect((await resolver(bundled).resolve('codex')).status).toBe('missing');
  });

  it('trusts anything it has no installer for', async () => {
    expect((await resolver(deps([])).resolve('whatever')).status).toBe('ready');
  });
});
