import type { AuthCli, LoginChild, LoginKind } from '../domain/signin.js';
import { SignInService } from '../application/SignInService.js';
import { createHarness } from './harness.js';

export class FakeChild implements LoginChild {
  data: Array<(t: string) => void> = [];
  exit: Array<(c: number | null) => void> = [];
  written: string[] = [];
  killed = false;
  onData(l: (t: string) => void) {
    this.data.push(l);
  }
  onExit(l: (c: number | null) => void) {
    this.exit.push(l);
  }
  write(t: string) {
    this.written.push(t);
  }
  kill() {
    this.killed = true;
  }
  say(t: string) {
    this.data.forEach((l) => l(t));
  }
  end(c: number | null) {
    this.exit.forEach((l) => l(c));
  }
}

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
