/**
 * Turn failures caused by credentials start with this marker, so a client can offer to sign in. What follows
 * it is the human text. The rule: a `turn-end.error` that is about credentials begins with exactly `AUTH: `.
 */
export const AUTH_MARKER = 'AUTH: ';

/** Words of a failure that is about credentials (Claude's "Not logged in", a 401, a rejected key...). */
const AUTH_FAILURE =
  /not logged in|not signed in|could not sign in|please run \/login|invalid api key|missing api key|api key (?:is )?(?:missing|not set)|missing bearer|authentication[_ ]?(failed|error|required)|\b401\b|unauthori[sz]ed|oauth token .*(expired|revoked)/i;

/** The CLI's own sign-in message shown as an assistant answer: one short line that points at /login. */
const AUTH_LINE =
  /^(not logged in|invalid api key|missing api key|api key (?:is )?(?:missing|not set)|missing bearer|oauth token [^\n]*)\b[^\n]*\/login[^\n]*$/i;

export const isAuthFailure = (text: string): boolean => AUTH_FAILURE.test(text);

export const isAuthLine = (text: string): boolean => {
  const line = text.trim();
  return line.length < 200 && AUTH_LINE.test(line);
};

/** `text` with the marker when it is about credentials (and not already marked). */
export function markAuth(text: string): string {
  return text.startsWith(AUTH_MARKER) || !isAuthFailure(text) ? text : `${AUTH_MARKER}${text}`;
}
