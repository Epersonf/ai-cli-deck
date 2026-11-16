import { describe, expect, it } from 'vitest';
import { SignInService } from '../../application/SignInService.js';
import { readLoginOutput } from '../../application/loginOutput.js';
import { createProviderRegistry } from '../providers/registry.js';
import { createBuiltin } from '../providers/claude.js';
import { FakeChild } from '../../testing/fakeLoginChild.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
describe('plugin account and key authentication', () => {
  it('shows Google authorization, accepts the code, confirms it and clears the previous API key', async () => {
    const providers = createProviderRegistry([]);
    const child = new FakeChild();
    let signedIn = false;
    let key: 'set' | 'none' = 'set';
    let ownsLogin = false;
    providers.add({
      ...createBuiltin('google', 'Google', 'antigravity'),
      keyState: () => key,
      login: {
        env: () => ({}),
        own: () => ownsLogin,
        setOwn: (on) => {
          ownsLogin = on;
        },
      },
      authentication: {
        methods: [
          {
            id: 'antigravity-google',
            label: 'Google account',
            description: '',
            flow: 'code',
            help: '',
          },
        ],
        login: () => child,
        status: async () => ({
          state: signedIn ? 'signed-in' : 'signed-out',
          via: signedIn ? 'Google account' : null,
          account: null,
        }),
        logout: async () => {
          signedIn = false;
        },
      },
    });
    const service = new SignInService({
      providers,
      cli: {
        login: () => {
          throw new Error('Wrong login backend');
        },
        run: async () => null,
      },
      profiles: {
        has: () => true,
        setSecret: async () => {
          key = 'none';
        },
      },
    });
    await service.start('google', 'antigravity-google');
    child.say(
      'Open https://accounts.google.com/o/oauth2/auth?state=example\n\nEnter authorization code: ',
    );
    expect(service.current('google')).toMatchObject({
      state: 'running',
      url: 'https://accounts.google.com/o/oauth2/auth?state=example',
      needsCode: true,
    });
    service.input('google', 'google-code');
    expect(child.written).toEqual(['google-code\n']);
    signedIn = true;
    child.end(0);
    await tick();
    expect(service.current('google')?.state).toBe('done');
    expect(key).toBe('none');
    expect(ownsLogin).toBe(true);
    expect((await service.auth('google', true)).state).toBe('signed-in');
    await service.logout('google');
    expect((await service.auth('google', true)).state).toBe('signed-out');
  });
  it('recognizes the code prompt printed by the official terminal OAuth flow', () => {
    expect(
      readLoginOutput('https://accounts.google.com/auth\n\nPaste authorization code here: '),
    ).toMatchObject({ needsCode: true });
  });
});
