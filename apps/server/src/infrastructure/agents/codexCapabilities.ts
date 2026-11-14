import { execFile } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentCapabilities } from '../../domain/agent.js';
import { resolveCodex } from './codexBin.js';

const cache = new Map<string, { at: number; result: Promise<AgentCapabilities> }>();

/** Feature detection spends no model tokens and respects the profile's executable/environment. */
export function codexCapabilities(env: Record<string, string>): Promise<AgentCapabilities> {
  const bin = resolveCodex(env);
  const key = JSON.stringify([bin.command, bin.prefix]);
  const kept = cache.get(key);
  if (kept && Date.now() - kept.at < 300_000) return kept.result;
  const run = (args: string[]): Promise<string> =>
    new Promise((resolve, reject) => {
      execFile(
        bin.command,
        [...bin.prefix, ...args],
        { env, timeout: 15_000, maxBuffer: 128 * 1024 },
        (error, stdout) => (error ? reject(error) : resolve(stdout)),
      );
    });
  const result = (async (): Promise<AgentCapabilities> => {
    const results = await Promise.allSettled([
      run(['exec', 'fork', '--help']),
      (async () => {
        const dir = await mkdtemp(join(tmpdir(), 'deck-codex-schema-'));
        try {
          await run(['app-server', 'generate-json-schema', '--out', dir]);
          await access(join(dir, 'v2', 'ThreadCompactStartParams.json'));
          await access(join(dir, 'v2', 'ThreadResumeParams.json'));
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      })(),
    ]);
    return {
      fork:
        results[0]?.status === 'fulfilled' && /Usage:\s+codex exec fork\b/.test(results[0].value),
      compact: results[1]?.status === 'fulfilled',
    };
  })();
  cache.set(key, { at: Date.now(), result });
  return result;
}
