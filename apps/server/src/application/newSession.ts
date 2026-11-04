import type { CreateSessionBody, Session } from '@deck/shared';

interface Origin {
  id: string;
  now: Date;
  persistent: boolean;
}

/** A fresh session record in the "starting" state, before its process is spawned. */
export function newSession(
  body: CreateSessionBody,
  cwd: string,
  port: number,
  from: Origin,
): Session {
  return {
    id: from.id,
    provider: body.provider,
    cwd,
    status: 'starting',
    createdAt: from.now.toISOString(),
    previewUrl: null,
    port,
    worktree: { enabled: body.useWorktree, path: null, branch: null },
    persistent: from.persistent,
    sharedCwdWith: [],
    name: null,
    parentId: body.parentId ?? null,
    meta: {},
  };
}
