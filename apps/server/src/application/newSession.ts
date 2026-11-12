import type { CreateSessionBody, Session } from '@deck/shared';

interface Origin {
  id: string;
  now: Date;
}

/** A fresh session record, waiting for its first message. */
export function newSession(
  body: Pick<CreateSessionBody, 'provider' | 'useWorktree'> & { parentId?: string | null },
  cwd: string,
  port: number,
  from: Origin,
): Session {
  return {
    id: from.id,
    provider: body.provider,
    cwd,
    status: 'idle',
    createdAt: from.now.toISOString(),
    previewUrl: null,
    port,
    worktree: { enabled: body.useWorktree, path: null, branch: null },
    sharedCwdWith: [],
    name: null,
    parentId: body.parentId ?? null,
    meta: {},
  };
}
