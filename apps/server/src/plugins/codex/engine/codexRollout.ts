import { open, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { UsageReading } from '../../../domain/agent.js';

type Json = Record<string, unknown>;

const obj = (v: unknown): Json | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Json) : null;
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** A usage window as Codex names it by its length: 300 minutes is the 5-hour one, 10080 the weekly one. */
export function windowOf(minutes: number): { key: string; label: string } {
  if (minutes === 10_080) return { key: 'seven_day', label: 'Weekly limit' };
  if (minutes === 300) return { key: 'five_hour', label: '5-hour limit' };
  if (minutes % 60 === 0 && minutes < 48 * 60)
    return { key: `w${minutes}`, label: `${minutes / 60}-hour limit` };
  return { key: `w${minutes}`, label: `${minutes}-minute limit` };
}

/** What one `token_count` line of a Codex rollout says about usage; null for any other line. */
export function codexTokenCount(line: string, now: number = Date.now()): UsageReading[] {
  let json: unknown;
  try {
    json = JSON.parse(line);
  } catch {
    return [];
  }
  const payload = obj(obj(json)?.['payload']);
  if (payload?.['type'] !== 'token_count') return [];
  const out: UsageReading[] = [];
  const info = obj(payload['info']);
  const last = obj(info?.['last_token_usage']);
  const window = num(info?.['model_context_window']);
  if (last) {
    const input = num(last['input_tokens']) ?? 0;
    const cached = Math.min(input, num(last['cached_input_tokens']) ?? 0);
    const write = num(last['cache_write_input_tokens']);
    const context = input + (num(last['output_tokens']) ?? 0);
    out.push({
      ...(context > 0 ? { contextTokens: context } : {}),
      ...(window ? { contextWindow: window } : {}),
      ...(input > 0
        ? {
            cache: {
              scope: 'request',
              read: cached,
              write,
              uncached: Math.max(0, input - cached - (write ?? 0)),
              ttlMs: null,
            },
          }
        : {}),
    });
  }
  const limits = obj(payload['rate_limits']);
  for (const name of ['primary', 'secondary']) {
    const w = obj(limits?.[name]);
    const used = num(w?.['used_percent']);
    const minutes = num(w?.['window_minutes']);
    if (!w || used === null || minutes === null) continue;
    const at = num(w['resets_at']);
    const inSeconds = num(w['resets_in_seconds']);
    const resets = at !== null ? at * 1000 : inSeconds !== null ? now + inSeconds * 1000 : null;
    out.push({
      limit: {
        ...windowOf(minutes),
        used: Math.min(1, Math.max(0, used / 100)),
        resetsAt: resets === null ? null : new Date(resets).toISOString(),
      },
    });
  }
  return out;
}

/** The newest-first names inside a folder (the sessions are kept as year/month/day). */
export async function newestFirst(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).sort().reverse();
  } catch {
    return [];
  }
}

/** Codex's own folder: `CODEX_HOME` of the profile, else the machine's. */
export const codexHome = (env: Record<string, string>): string =>
  env['CODEX_HOME'] || join(homedir(), '.codex');

/** Where Codex saved the thread's rollout: `sessions/YYYY/MM/DD/rollout-<time>-<thread id>.jsonl`. */
async function rolloutOf(home: string, threadId: string): Promise<string | null> {
  const root = join(home, 'sessions');
  for (const year of await newestFirst(root))
    for (const month of await newestFirst(join(root, year)))
      for (const day of await newestFirst(join(root, year, month))) {
        const dir = join(root, year, month, day);
        const file = (await newestFirst(dir)).find((f) => f.endsWith(`-${threadId}.jsonl`));
        if (file) return join(dir, file);
      }
  return null;
}

const TAIL_BYTES = 256 * 1024;

/** The last `token_count` of a rollout file (what it says of context, cache and limits); empty when it has none. */
export async function lastReadings(path: string): Promise<UsageReading[]> {
  const file = await open(path, 'r');
  try {
    const { size } = await file.stat();
    const start = Math.max(0, size - TAIL_BYTES);
    const buffer = Buffer.alloc(size - start);
    await file.read(buffer, 0, buffer.length, start);
    for (const line of buffer.toString('utf8').split('\n').reverse()) {
      // A compaction after the last count makes that old occupancy invalid.
      try {
        const entry = obj(JSON.parse(line));
        if (
          entry?.['type'] === 'compacted' ||
          obj(entry?.['payload'])?.['type'] === 'context_compacted'
        )
          return [{ compacted: true }];
      } catch {
        /* Partial first line of the bounded tail. */
      }
      if (!line.includes('"token_count"')) continue;
      const readings = codexTokenCount(line);
      if (readings.length) return readings;
    }
  } finally {
    await file.close();
  }
  return [];
}

/** The last `token_count` of the thread's rollout: context, cache and the account's windows. Best effort. */
export async function codexUsage(
  env: Record<string, string>,
  threadId: string,
): Promise<UsageReading[]> {
  try {
    const path = await rolloutOf(codexHome(env), threadId);
    return path ? await lastReadings(path) : [];
  } catch {
    return []; // no rollout to read: the figures stay as the turn's own usage gave them
  }
}
