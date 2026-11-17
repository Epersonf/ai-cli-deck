import { homedir } from 'node:os';
import type { AuthInfo } from '@deck/shared';
import { GrokRpc } from './engine/grokRpc.js';
import { obj, str } from '../codex/engine/codexJson.js';

/** Verify cached credentials by opening (and closing) a session, without sending a model prompt. */
export async function grokAuth(binary: string, env: Record<string, string>): Promise<AuthInfo> {
  const rpc = new GrokRpc(
    homedir(),
    { ...env, DECK_GROK_BIN: binary },
    () => undefined,
    () => undefined,
  );
  try {
    const initialized = await rpc.request(
      'initialize',
      {
        protocolVersion: 1,
        clientCapabilities: {},
        clientInfo: { name: 'ai-cli-deck', version: '0.1.0' },
      },
      8000,
    );
    const sessions = obj(obj(initialized['agentCapabilities'])?.['sessionCapabilities']);
    const session = await rpc.request('session/new', { cwd: homedir(), mcpServers: [] }, 8000);
    if (!str(session['sessionId'])) return { state: 'unknown', via: null, account: null };
    if (sessions?.['close'])
      await rpc.request('session/close', { sessionId: session['sessionId'] }, 8000);
    return {
      state: 'signed-in',
      via: env['XAI_API_KEY'] ? 'API key' : 'Grok',
      account: null,
    };
  } catch (error) {
    return {
      state:
        error instanceof Error &&
        /auth|not signed in|not logged in|unauthenticated|sign in|log in/i.test(error.message)
          ? 'signed-out'
          : 'unknown',
      via: null,
      account: null,
    };
  } finally {
    rpc.close();
  }
}
