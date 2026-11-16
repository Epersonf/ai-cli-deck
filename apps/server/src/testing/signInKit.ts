import type { AuthCli, LoginKind } from '../domain/signin.js';
import { SignInService } from '../application/SignInService.js';
import { createHarness } from './harness.js';

import { FakeChild } from './fakeLoginChild.js';
export { FakeChild } from './fakeLoginChild.js';

export function service() {
  const h = createHarness();
  const children: Array<{ kind: LoginKind; env: Record<string, string>; child: FakeChild }> = [];
  const runs: Array<[string, string]> = [];
  let loggedIn = false;
  const cli: AuthCli = {
    login: (kind, env) => {
      const child = new FakeChild();
      children.push({ kind, env, child });
      return child;
    },
    run: (agent, action) => {
      runs.push([agent, action]);
      const out =
        agent === 'claude'
          ? JSON.stringify({ loggedIn, authMethod: 'claude.ai' })
          : loggedIn
            ? 'Logged in using ChatGPT'
            : 'Not logged in';
      return Promise.resolve({ code: loggedIn ? 0 : 1, output: out });
    },
  };
  const secrets: string[] = [];
  const own = { on: false };
  const providers = {
    ...h.providers,
    get: (id: string) => {
      const p = h.providers.get(id);
      return (
        p && {
          ...p,
          login: {
            env: () => ({ CLAUDE_CONFIG_DIR: '/home/p' }),
            own: () => own.on,
            setOwn: (on: boolean) => void (own.on = on),
          },
        }
      );
    },
  };
  const svc = new SignInService({
    providers: providers as never,
    cli,
    profiles: {
      has: (id) => id === 'work',
      setSecret: (_id, s) => Promise.resolve(void secrets.push(s)),
    },
  });
  return { svc, children, runs, secrets, own, login: () => (loggedIn = true) };
}
