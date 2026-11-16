import type { AuthInfo } from '@deck/shared';
import { cleanOutput } from '../../application/loginOutput.js';

const VIA: Record<string, string> = {
  'claude.ai': 'Claude subscription',
  console: 'Console API',
  oauth_token: 'Claude token',
  api_key: 'API key',
};
export function claudeAuthStatus(
  answer: { code: number | null; output: string } | null,
  machine = false,
): AuthInfo {
  const unknown: AuthInfo = { state: 'unknown', via: null, account: null };
  if (!answer) return unknown;
  try {
    const text = cleanOutput(answer.output).trim();
    const json = JSON.parse(text.slice(text.indexOf('{'))) as Record<string, unknown>;
    if (json['loggedIn'] !== true) return { state: 'signed-out', via: null, account: null };
    const method = typeof json['authMethod'] === 'string' ? json['authMethod'] : '';
    return {
      state: 'signed-in',
      via: machine ? "this machine's login" : (VIA[method] ?? (method || 'Claude')),
      account: typeof json['email'] === 'string' ? json['email'] : null,
    };
  } catch {
    return unknown;
  }
}
