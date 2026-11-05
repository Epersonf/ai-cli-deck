import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

export type Json = Record<string, unknown>;

/** An object, or null for anything else. */
export const obj = (value: unknown): Json | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : null;

export const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const parse = (line: string): Json | null => {
  try {
    return obj(JSON.parse(line));
  } catch {
    return null; // a line being written right now, or not JSON at all
  }
};

/**
 * Every JSON object of a JSON-lines file, read as a stream (chat files grow to many megabytes, and their
 * first line alone can pass 100 KB). Stopping early closes the file.
 */
export async function* jsonLines(path: string): AsyncGenerator<Json> {
  const input = createReadStream(path);
  const lines = createInterface({ input, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      const parsed = parse(line);
      if (parsed) yield parsed;
    }
  } finally {
    lines.close();
    input.destroy();
  }
}

/** Lines read from the start of a chat at most, looking for its first request. */
export const MAX_HEAD_LINES = 400;
const CACHE_LIMIT = 2000;

/** A result per file kept while the file is unchanged: listing chats would otherwise reread them all. */
export function perFile<T>() {
  const cache = new Map<string, { mtimeMs: number; value: T }>();
  return async (key: string, mtimeMs: number, load: () => Promise<T>): Promise<T> => {
    const hit = cache.get(key);
    if (hit && hit.mtimeMs === mtimeMs) return hit.value;
    const value = await load();
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value ?? key);
    cache.set(key, { mtimeMs, value });
    return value;
  };
}

/** A date from an ISO string, or `fallback`. */
export const dateOf = (value: unknown, fallback: Date): Date => {
  const text = str(value);
  const date = text === null ? null : new Date(text);
  return date && !Number.isNaN(date.getTime()) ? date : fallback;
};
