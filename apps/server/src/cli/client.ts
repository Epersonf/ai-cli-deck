import { AGENT_PATH } from '@deck/shared';

export interface Env {
  url: string;
  sessionId: string;
}

export function readEnv(env: NodeJS.ProcessEnv): Env | null {
  const url = env['DECK_URL'];
  const sessionId = env['DECK_SESSION_ID'];
  return url && sessionId ? { url, sessionId } : null;
}

/** Calls the loopback-only agent API of the deck for this session. */
export async function call(
  env: Env,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<unknown> {
  const init: RequestInit = { method, headers: { 'content-type': 'application/json' } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const response = await fetch(
    `${env.url}${AGENT_PATH}/${encodeURIComponent(env.sessionId)}${path}`,
    init,
  );
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as { error?: unknown }).error;
    throw new Error(typeof message === 'string' ? message : `request failed (${response.status})`);
  }
  return payload;
}
