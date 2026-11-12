import { homedir } from 'node:os';
import type { ModelListing } from '../../domain/provider.js';
import type { QueryFn } from '../agents/claudeDriver.js';

const TIMEOUT_MS = 30_000;

/**
 * Asks Claude Code which models this account can use (the SDK's `supportedModels`), through a query that
 * never gets a message: it only needs to start, answer and be closed again.
 */
export async function claudeModels(
  query: QueryFn,
  env: Record<string, string>,
): Promise<ModelListing> {
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
    const found = await Promise.race([q.supportedModels(), timeout]);
    const choices = found.map((m) => ({
      id: m.value,
      label: m.displayName || m.value,
      description: m.description || null,
    }));
    return { choices, current: env['ANTHROPIC_MODEL'] || null };
  } finally {
    abort.abort();
    try {
      q.close();
    } catch {
      // already closed
    }
  }
}
