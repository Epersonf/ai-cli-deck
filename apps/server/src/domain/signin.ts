import type { AgentKind } from '@deck/shared';

/** A CLI process whose output and input the deck follows (a login waiting for a pasted code). */
export interface LoginChild {
  onData(listener: (text: string) => void): void;
  onExit(listener: (code: number | null) => void): void;
  write(text: string): void;
  kill(): void;
}

export type LoginKind = string;

/** The agents' own sign-in commands, run without a terminal. */
export interface AuthCli {
  /** Starts the login; `env` is the profile's folder variable only. */
  login(kind: LoginKind, env: Record<string, string>): LoginChild;
  /** Runs `status` or `logout` for an agent and returns what it printed (null when it did not answer in time). */
  run(
    agent: AgentKind,
    action: 'status' | 'logout',
    env: Record<string, string>,
  ): Promise<{ code: number | null; output: string } | null>;
}

/** What a provider offers for signing in: the folder its login lives in, and whether it uses its own. */
export interface LoginSupport {
  /** The variable naming the profile's own config folder (empty for a built-in, which is the machine's). */
  env(): Record<string, string>;
  /** True when the agent uses this profile's own login rather than the machine's. */
  own(): boolean;
  /** Remember (or forget) that the agent should use this profile's own login. */
  setOwn(on: boolean): void;
}
