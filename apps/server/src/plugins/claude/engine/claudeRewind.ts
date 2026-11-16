import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AgentSpec, RewindResult } from '../../../domain/agent.js';
import { claudeProjectDir } from '../chats.js';
import type { QueryFn } from './claudeDriver.js';

const FILES_TIMEOUT_MS = 30_000;

/**
 * The entry of Claude's saved chat just before the user message `userId` (which the deck gave its uuid):
 * resuming "at" it drops that message and everything after. Null when the chat or message is not found.
 */
export async function entryBefore(
  spec: Pick<AgentSpec, 'env' | 'cwd' | 'resumeId'>,
  userId: string,
): Promise<string | null> {
  if (!spec.resumeId) return null;
  const home = spec.env['CLAUDE_CONFIG_DIR'] ?? join(homedir(), '.claude');
  const file = join(claudeProjectDir(home, spec.cwd), `${spec.resumeId}.jsonl`);
  const text = await readFile(file, 'utf8').catch(() => '');
  for (const line of text.split('\n')) {
    if (!line.includes(userId)) continue;
    try {
      const entry = JSON.parse(line) as { uuid?: unknown; parentUuid?: unknown };
      if (entry.uuid === userId && typeof entry.parentUuid === 'string') return entry.parentUuid;
    } catch {
      // a half-written line
    }
  }
  return null;
}

/** Puts the files back as they were at the user message `userId`, using Claude's file checkpoints. */
async function restoreFiles(
  queryFn: QueryFn,
  spec: AgentSpec,
  userId: string,
): Promise<string | null> {
  const abort = new AbortController();
  // An input that never has a message and ends when aborted: all this query is for is `rewindFiles`.
  const idle: AsyncIterable<never> = {
    [Symbol.asyncIterator]: () => ({
      next: () =>
        new Promise((resolve) =>
          abort.signal.addEventListener('abort', () => resolve({ done: true, value: undefined })),
        ),
    }),
  };
  const q = queryFn({
    prompt: idle,
    options: {
      cwd: spec.cwd,
      env: spec.env,
      resume: spec.resumeId,
      enableFileCheckpointing: true,
      abortController: abort,
    },
  });
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Claude did not answer in time.')), FILES_TIMEOUT_MS).unref(),
  );
  try {
    const result = await Promise.race([q.rewindFiles(userId), timeout]);
    return result.canRewind
      ? null
      : (result.error ?? 'The files cannot be restored to that point.');
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    abort.abort();
    try {
      q.close();
    } catch {
      // already closed
    }
  }
}

/** Where to resume for an edited message, after putting the files back when asked. */
export async function claudeRewind(
  queryFn: QueryFn,
  spec: AgentSpec,
  userId: string,
  revertFiles: boolean,
): Promise<RewindResult> {
  if (revertFiles && spec.resumeId) {
    const error = await restoreFiles(queryFn, spec, userId);
    if (error) return { resumeAt: null, error };
  }
  return { resumeAt: await entryBefore(spec, userId) };
}
