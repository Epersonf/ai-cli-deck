import type { AuthInfo } from '@deck/shared';
import { cleanOutput } from '../../application/loginOutput.js';

export function codexAuthStatus(
  answer: { code: number | null; output: string } | null,
  machine = false,
): AuthInfo {
  if (!answer) return { state: 'unknown', via: null, account: null };
  const text = cleanOutput(answer.output).trim();
  if (/not logged in/i.test(text)) return { state: 'signed-out', via: null, account: null };
  if (answer.code === 0 && /logged in/i.test(text))
    return {
      state: 'signed-in',
      via: machine
        ? "this machine's login"
        : /chatgpt/i.test(text)
          ? 'ChatGPT'
          : /api key/i.test(text)
            ? 'API key'
            : 'Codex',
      account: null,
    };
  return { state: answer.code === 1 ? 'signed-out' : 'unknown', via: null, account: null };
}
