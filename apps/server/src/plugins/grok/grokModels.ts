import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import type { ModelListing } from '../../domain/provider.js';
import { grokCommand, GrokRpc } from './engine/grokRpc.js';
import { jsonList } from '../antigravity/engine/antigravityMap.js';
import { cleanOutput } from '../../application/loginOutput.js';
import { obj, str, type Json } from '../codex/engine/codexJson.js';

/** `grok models` prints "  * grok-4.7 (default)" / "  - grok-4.5" under "Available models:". */
export function parseGrokModels(text: string): ModelListing {
  const choices: ModelListing['choices'] = [];
  let current: string | null = null;
  for (const line of cleanOutput(text).split('\n')) {
    const row = /^\s*([*-])\s+([\w][\w.-]*)(?:\s+\((default)\))?\s*$/.exec(line);
    if (!row?.[2]) continue;
    choices.push({ id: row[2], label: row[2], description: null });
    if (row[1] === '*' || row[3]) current ??= row[2];
  }
  return { choices, current };
}

/** The account's models from a `session/new` answer: ids, display names and descriptions. */
export function grokSessionModels(response: Json): ModelListing {
  const models = obj(response['models']);
  const choices = jsonList(models?.['availableModels']).flatMap((model) => {
    const id = str(model['modelId']);
    return id
      ? [{ id, label: str(model['name']) || id, description: str(model['description']) || null }]
      : [];
  });
  return { choices, current: str(models?.['currentModelId']) || null };
}

function cliModels(command: string, env: Record<string, string>): Promise<ModelListing> {
  return new Promise((resolve) => {
    execFile(
      command,
      ['models'],
      { env, timeout: 20_000, maxBuffer: 1_000_000, windowsHide: true },
      (error, stdout) => resolve(error ? { choices: [], current: null } : parseGrokModels(stdout)),
    );
  });
}

/**
 * Asks Grok which models this account may use, without a prompt (no usage is spent). A session opened
 * and closed gives names and descriptions; `grok models` is the fallback and works before signing in.
 */
export async function grokModels(env: Record<string, string>): Promise<ModelListing> {
  const fullEnv = { ...process.env, ...env } as Record<string, string>;
  const rpc = new GrokRpc(
    homedir(),
    fullEnv,
    () => undefined,
    () => undefined,
  );
  try {
    const init = await rpc.request(
      'initialize',
      {
        protocolVersion: 1,
        clientCapabilities: {},
        clientInfo: { name: 'ai-cli-deck', version: '0.1.0' },
      },
      10_000,
    );
    const session = await rpc.request('session/new', { cwd: homedir(), mcpServers: [] }, 20_000);
    const sessions = obj(obj(init['agentCapabilities'])?.['sessionCapabilities']);
    if (sessions?.['close'] && str(session['sessionId']))
      await rpc
        .request('session/close', { sessionId: session['sessionId'] }, 8000)
        .catch(() => ({}));
    const listing = grokSessionModels(session);
    if (listing.choices.length) return listing;
  } catch {
    // not signed in, offline or too old: the plain catalog below
  } finally {
    rpc.close();
  }
  return cliModels(grokCommand(fullEnv), fullEnv);
}
