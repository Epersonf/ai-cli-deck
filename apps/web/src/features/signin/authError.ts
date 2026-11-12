import type { Block } from '../chat/blockTypes';

/** The server marks a turn that failed for lack of a login with this prefix. */
export const AUTH_PREFIX = 'AUTH:';
const NOT_LOGGED_IN = /not logged in|please run \/login|invalid api key|authentication[_ ]failed/i;

/** The marker is for the app, not the reader. */
export const stripAuth = (text: string): string =>
  text.startsWith(AUTH_PREFIX) ? text.slice(AUTH_PREFIX.length).trim() : text;

export const isAuthText = (text: string): boolean =>
  text.startsWith(AUTH_PREFIX) || NOT_LOGGED_IN.test(text);

/** True when the newest turn (after the last message of the person) failed because nobody is signed in. */
export function authFailed(blocks: readonly Block[]): boolean {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    if (!block || block.kind === 'user') return false;
    if (block.kind === 'turn' && block.error !== null && isAuthText(block.error)) return true;
    if (block.kind === 'text' && !block.streaming && isAuthText(block.text)) return true;
  }
  return false;
}

/** `/login` and `/logout` are handled by the app: the agent cannot run them here. */
export const isLoginCommand = (text: string): boolean => /^\/(login|logout)\s*$/i.test(text.trim());
