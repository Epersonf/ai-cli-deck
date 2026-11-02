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

const resolver = (d: StatusDeps) =>
  new ProviderStatusResolver(SETUP_SPECS, [{ id: 'aider', command: 'aider' }], d);

describe('ProviderStatusResolver', () => {
  it('only reports whether the CLI is installed, never whether it is signed in', async () => {
    expect(await resolver(deps([])).resolve('claude')).toEqual({
      status: 'missing',
      hint: 'claude is not installed',
      canInstall: true,
    });
    expect((await resolver(deps(['/usr/bin/claude'])).resolve('claude')).status).toBe('ready');
    expect((await resolver(deps(['/usr/bin/codex'])).resolve('codex')).status).toBe('ready');
  });

  it('shares the claude binary with the DeepSeek provider', async () => {
    expect((await resolver(deps(['/usr/bin/claude'])).resolve('claude-deepseek')).status).toBe(
      'ready',
    );
    expect((await resolver(deps([])).resolve('claude-deepseek')).status).toBe('missing');
  });

  it('checks configured commands and trusts shell/custom', async () => {
    expect((await resolver(deps([])).resolve('aider')).status).toBe('missing');
    expect((await resolver(deps([])).resolve('aider')).canInstall).toBe(false);
    expect((await resolver(deps(['/usr/bin/aider'])).resolve('aider')).status).toBe('ready');
    expect((await resolver(deps([])).resolve('shell')).status).toBe('ready');
  });
});
