import type { WebTool } from './codexWeb.js';
import type { RetryHint } from '@deck/shared';
import { AUTH_MARKER, isAuthFailure } from '../../domain/authError.js';

/** What the mapper remembers between lines of one `codex exec` run. */
export interface CodexState {
  /** Exec restarts item numbering on each message; the deck needs ids unique across the chat. */
  itemPrefix: string;
  /** Tool items already announced (so their completion only adds the result). */
  started: Set<string>;
  /** Latest web details, so later notifications update the existing card. */
  webTools: Map<string, WebTool>;
  /** The last error Codex printed; used when the process ends without finishing the turn. */
  lastError: string | null;
  retry: RetryHint | null;
  finished: boolean;
  startedAt: number;
}

export const newCodexState = (itemPrefix = ''): CodexState => ({
  itemPrefix,
  started: new Set(),
  webTools: new Map(),
  lastError: null,
  retry: null,
  finished: false,
  startedAt: Date.now(),
});

/** Codex retries a failing connection five times and says so on every try: not worth showing. */
export const RETRY_NOISE = /^(Reconnecting|Falling back)/;

/** What Codex said when a turn failed, with a hint when the cause is a missing or wrong key. */
export function friendlyError(message: string): string {
  return isAuthFailure(message)
    ? `${AUTH_MARKER}Codex could not sign in: sign in again or set a key for this profile. ${message.slice(0, 200)}`
    : message;
}
