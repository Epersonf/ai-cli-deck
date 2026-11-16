import { homedir } from 'node:os';
import type { QueryFn, QueryLike } from './engine/claudeDriver.js';

const TIMEOUT_MS = 30_000;

/**
 * Starts Claude Code with no message, lets `ask` put one question to it (models, usage...) and closes it
 * again. Gives up after 30 seconds.
 */
export async function withIdleQuery<T>(
  query: QueryFn,
  env: Record<string, string>,
  ask: (q: QueryLike) => Promise<T>,
): Promise<T> {
  const abort = new AbortController();
  const idle: AsyncIterable<never> = {
    [Symbol.asyncIterator]: () => ({
      next: () =>
        new Promise((resolve) =>
          abort.signal.addEventListener('abort', () => resolve({ done: true, value: undefined })),
        ),
    }),
  };
  const q = query({
    prompt: idle,
    options: { cwd: homedir(), env: { ...process.env, ...env }, abortController: abort },
  });
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Claude did not answer in time.')), TIMEOUT_MS).unref(),
  );
  try {
    return await Promise.race([ask(q), timeout]);
  } finally {
    abort.abort();
    try {
      q.close();
    } catch {
      // already closed
    }
  }
}
