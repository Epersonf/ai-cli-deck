import { normalizeUrl } from '@deck/shared';
import { notFound } from '../../domain/errors.js';
import type { Container } from '../container.js';

export type AgentDeps = Pick<Container, 'sessions' | 'approvals' | 'preview'>;

/**
 * Everything an agent may do, scoped to ONE session. Shared by the MCP tools and the `clideck`
 * command so both behave identically. Nothing here runs git or touches the filesystem: the
 * worktree can only be PROPOSED; the user approves it in the UI.
 */
export function createAgentTools(deps: AgentDeps, sessionId: string) {
  const self = () => {
    const session = deps.sessions.get(sessionId);
    if (!session) throw notFound(`Session ${sessionId}`);
    return session;
  };

  return {
    whoami: () => {
      const { id, provider, cwd, port, previewUrl, worktree, status } = self();
      return { id, provider, cwd, port, previewUrl, worktree, status };
    },

    listSessions: () => {
      const me = self();
      return deps.sessions
        .list()
        .filter((s) => s.id !== me.id)
        .map((s) => ({
          id: s.id,
          provider: s.provider,
          cwd: s.cwd,
          status: s.status,
          sameFolderAsYou: s.cwd === me.cwd,
        }));
    },

    proposeWorktree: (reason: string) => {
      const request = deps.approvals.propose(self().id, reason);
      return { status: 'pending' as const, requestId: request.id };
    },

    openPreview: (url: string) => ({ url: deps.preview.open(self().id, normalizeUrl(url)) }),

    suggestNewTab: (url: string) => ({
      url: deps.preview.suggestNewTab(self().id, normalizeUrl(url)),
    }),

    requestStatus: (requestId: string) => {
      const request = deps.approvals.get(requestId);
      if (request.sessionId !== sessionId) throw notFound(`Request ${requestId}`);
      return { status: request.status, path: request.resultPath };
    },
  };
}

export type AgentTools = ReturnType<typeof createAgentTools>;
