import type { AgentKind, AuthInfo } from '@deck/shared';
import { cleanOutput } from './loginOutput.js';

const UNKNOWN: AuthInfo = { state: 'unknown', via: null, account: null };

const CLAUDE_VIA: Record<string, string> = {
  'claude.ai': 'Claude subscription',
  console: 'Console API',
  oauth_token: 'Claude token',
  api_key: 'API key',
};

/**
 * Reads what `claude auth status` (JSON) or `codex login status` printed. `machine` is true when the agent
 * uses the machine's own login, which the answer is then called.
 */
export function readAuthStatus(
  agent: AgentKind,
  answer: { code: number | null; output: string } | null,
  machine: boolean,
): AuthInfo {
  if (answer === null) return UNKNOWN;
  const text = cleanOutput(answer.output).trim();
  let info: AuthInfo;
  if (agent === 'claude') {
    try {
      const json = JSON.parse(text.slice(text.indexOf('{'))) as Record<string, unknown>;
      const method = typeof json['authMethod'] === 'string' ? json['authMethod'] : '';
      info =
        json['loggedIn'] === true
          ? {
              state: 'signed-in',
              via: CLAUDE_VIA[method] ?? (method || 'Claude'),
              account: typeof json['email'] === 'string' ? json['email'] : null,
            }
          : { state: 'signed-out', via: null, account: null };
    } catch {
      return UNKNOWN;
    }
  } else if (answer.code === 0 && /logged in/i.test(text)) {
    const via = /chatgpt/i.test(text) ? 'ChatGPT' : /api key/i.test(text) ? 'API key' : 'Codex';
    info = { state: 'signed-in', via, account: null };
  } else if (/not logged in/i.test(text) || answer.code === 1) {
    info = { state: 'signed-out', via: null, account: null };
  } else return UNKNOWN;
  return machine && info.state === 'signed-in' ? { ...info, via: "this machine's login" } : info;
}
