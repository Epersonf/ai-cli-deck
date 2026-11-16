import { homedir } from 'node:os';
import type { AuthInfo } from '@deck/shared';
import { AntigravityRpc } from './engine/antigravityRpc.js';
import { obj, str } from '../codex/engine/codexJson.js';

/** Verify cached credentials without sending a model prompt. */
export async function antigravityAuth(
  binary: string,
  env: Record<string, string>,
): Promise<AuthInfo> {
  const rpc = new AntigravityRpc(
    homedir(),
    { ...env, DECK_ANTIGRAVITY_BIN: binary },
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
    const caps = obj(initialized['agentCapabilities']);
    const sessions = obj(caps?.['sessionCapabilities']);
    {
      const session = await rpc.request('session/new', { cwd: homedir(), mcpServers: [] }, 8000);
      if (!str(session['sessionId'])) return { state: 'unknown', via: null, account: null };
      if (sessions?.['close'])
        await rpc.request('session/close', { sessionId: session['sessionId'] }, 8000);
    }
    return { state: 'signed-in', via: 'Antigravity', account: null };
  } catch (error) {
    return {
      state:
        error instanceof Error &&
        /authentication required|not signed in|not logged in/i.test(error.message)
          ? 'signed-out'
          : 'unknown',
      via: null,
      account: null,
    };
  } finally {
    rpc.close();
  }
}
