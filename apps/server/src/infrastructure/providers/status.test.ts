import { SETUP_SPECS } from '@deck/shared';
import { describe, expect, it } from 'vitest';
import type { ProviderSecrets } from '../../domain/provider.js';
import { ProviderStatusResolver, findExecutable, type StatusDeps } from './status.js';

const NO_SECRETS: ProviderSecrets = {
  deepseekApiKey: null,
  anthropicApiKey: null,
  openaiApiKey: null,
};

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

const resolver = (d: StatusDeps, secrets = NO_SECRETS) =>
  new ProviderStatusResolver(SETUP_SPECS, [{ id: 'aider', command: 'aider' }], () => secrets, d);

describe('ProviderStatusResolver', () => {
  it('reports missing, unauthenticated and ready', async () => {
    expect((await resolver(deps([])).resolve('claude')).status).toBe('missing');
    const installed = deps(['/usr/bin/claude']);
    expect(await resolver(installed).resolve('claude')).toMatchObject({
      status: 'unauthenticated',
      canSetup: true,
    });
    const signedIn = deps(['/usr/bin/claude', '/home/u/.claude/.credentials.json']);
    expect((await resolver(signedIn).resolve('claude')).status).toBe('ready');
  });

  it('counts a saved key or an environment key as signed in', async () => {
    const d = deps(['/usr/bin/codex']);
    expect((await resolver(d, { ...NO_SECRETS, openaiApiKey: 'k' }).resolve('codex')).status).toBe(
      'ready',
    );
    const withEnv = deps(['/usr/bin/codex'], { OPENAI_API_KEY: 'k' });
    expect((await resolver(withEnv).resolve('codex')).status).toBe('ready');
  });

  it('needs a DeepSeek key even when claude is signed in', async () => {
    const d = deps(['/usr/bin/claude', '/home/u/.claude/.credentials.json']);
    expect((await resolver(d).resolve('claude-deepseek')).status).toBe('unauthenticated');
    expect(
      (await resolver(d, { ...NO_SECRETS, deepseekApiKey: 'k' }).resolve('claude-deepseek')).status,
    ).toBe('ready');
  });

  it('checks configured commands and trusts shell/custom', async () => {
    expect((await resolver(deps([])).resolve('aider')).status).toBe('missing');
    expect((await resolver(deps(['/usr/bin/aider'])).resolve('aider')).status).toBe('ready');
    expect((await resolver(deps([])).resolve('shell')).status).toBe('ready');
  });
});
