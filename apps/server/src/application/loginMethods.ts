import type { AgentKind, SignInMethod } from '@deck/shared';
import type { AuthCli, LoginKind } from '../domain/signin.js';
import { invalid } from '../domain/errors.js';

/** Compatibility for callers injecting the former CLI port (including saved JSON templates). */
export const LEGACY_LOGIN_KINDS: Partial<
  Record<SignInMethod, { kind: LoginKind; agent: AgentKind }>
> = {
  'claude-account': { kind: 'claude-account', agent: 'claude' },
  'claude-console': { kind: 'claude-console', agent: 'claude' },
  'codex-chatgpt': { kind: 'codex-chatgpt', agent: 'codex' },
};
export const NO_LEGACY_AUTH: AuthCli = {
  login: () => {
    throw invalid('This provider has no authentication plugin');
  },
  run: () => Promise.resolve(null),
};
