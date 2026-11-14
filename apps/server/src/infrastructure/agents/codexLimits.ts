import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { AccountLimit } from '../../domain/agent.js';
import { killTree } from '../process/killTree.js';
import { resolveCodex } from './codexBin.js';
import { windowOf } from './codexRollout.js';

const TIMEOUT_MS = 30_000;

type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Json) : null;
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** The windows of an `account/rateLimits/read` answer (the main bucket: 5-hour and weekly). */
export function parseRateLimits(result: unknown): AccountLimit[] {
  const bucket = obj(obj(result)?.['rateLimits']);
  return ['primary', 'secondary'].flatMap((name): AccountLimit[] => {
    const w = obj(bucket?.[name]);
    const used = num(w?.['usedPercent']);
    const minutes = num(w?.['windowDurationMins']);
    if (!w || used === null || minutes === null) return [];
    const at = num(w['resetsAt']);
    return [
      {
        ...windowOf(minutes),
        used: Math.min(1, Math.max(0, used / 100)),
        resetsAt: at === null ? null : new Date(at * 1000).toISOString(),
      },
    ];
  });
}

/**
 * The account's usage windows as the ChatGPT backend says them now, asked through Codex's own app server
 * (`account/rateLimits/read`): it counts everything the account used, on any device. No tokens are spent.
 * Empty when Codex is not signed in, offline or too old to know the call.
 */
export function codexLimits(env: Record<string, string>): Promise<AccountLimit[]> {
  const merged = { ...(process.env as Record<string, string>), ...env };
  const bin = resolveCodex(merged);
  const child = spawn(bin.command, [...bin.prefix, 'app-server'], { env: merged, stdio: 'pipe' });
  return new Promise((resolve) => {
    const done = (limits: AccountLimit[]): void => {
      clearTimeout(timer);
      killTree(child);
      resolve(limits);
    };
    const timer = setTimeout(() => done([]), TIMEOUT_MS);
    timer.unref();
    child.on('error', () => done([]));
    child.on('close', () => done([]));
    child.stdin.on('error', () => undefined);
    createInterface({ input: child.stdout }).on('line', (line) => {
      try {
        const message = obj(JSON.parse(line));
        if (message?.['id'] === 2) done(parseRateLimits(message['result']));
      } catch {
        // not a JSON line
      }
    });
    const send = (m: Json): void => void child.stdin.write(`${JSON.stringify(m)}\n`);
    send({
      id: 1,
      method: 'initialize',
      params: { clientInfo: { name: 'ai-cli-deck', version: '1' } },
    });
    send({ method: 'initialized' });
    send({ id: 2, method: 'account/rateLimits/read', params: null });
  });
}
