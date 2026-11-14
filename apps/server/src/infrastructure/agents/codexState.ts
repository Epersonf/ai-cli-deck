import { AUTH_MARKER } from '../../domain/authError.js';

/** What the mapper remembers between lines of one `codex exec` run. */
export interface CodexState {
  /** Exec restarts item numbering on each message; the deck needs ids unique across the chat. */
  itemPrefix: string;
  /** Tool items already announced (so their completion only adds the result). */
  started: Set<string>;
  /** The last error Codex printed; used when the process ends without finishing the turn. */
  lastError: string | null;
  finished: boolean;
  startedAt: number;
}

export const newCodexState = (itemPrefix = ''): CodexState => ({
  itemPrefix,
  started: new Set(),
  lastError: null,
  finished: false,
  startedAt: Date.now(),
});

/** Codex retries a failing connection five times and says so on every try: not worth showing. */
export const RETRY_NOISE = /^(Reconnecting|Falling back)/;

const NOT_SIGNED_IN = /401|unauthori[sz]ed|bearer|api key|not logged in|log in/i;

/** What Codex said when a turn failed, with a hint when the cause is a missing or wrong key. */
export function friendlyError(message: string): string {
  return NOT_SIGNED_IN.test(message)
    ? `${AUTH_MARKER}Codex could not sign in: sign in again or set a key for this profile. ${message.slice(0, 200)}`
    : message;
}
