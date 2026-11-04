import { normalizeUrl } from '@deck/shared';
import { notFound } from '../../domain/errors.js';
import type { Container } from '../container.js';

const TITLE_MAX = 60;

export type AgentDeps = Pick<Container, 'sessions' | 'approvals' | 'preview' | 'browser'>;

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

    /**
     * Only terminals of the SAME profile: a profile is a separate world (its own CLI login, key and
     * endpoint), so an agent in one must not even see the sessions of another.
     */
    listSessions: () => {
      const me = self();
      return deps.sessions
        .list()
        .filter((s) => s.id !== me.id && s.provider === me.provider)
        .map((s) => ({
          id: s.id,
          provider: s.provider,
          cwd: s.cwd,
          status: s.status,
          sameFolderAsYou: s.cwd === me.cwd,
        }));
    },

    /** Reads (no argument) or sets the name shown for this terminal in the deck. Kept tiny on purpose. */
    title: async (name?: string) => {
      if (name === undefined) return { title: self().name };
      const clean = name.replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX);
      return { title: (await deps.sessions.rename(sessionId, clean === '' ? null : clean)).name };
    },

    /**
     * Notes kept with this session, e.g. the id of its chat so it can be resumed. No key: all of them;
     * a key alone: that value; key and value: save it (an empty value removes it).
     */
    meta: async (key?: string, value?: string) => {
      if (key === undefined) return self().meta;
      if (value === undefined) return { [key]: self().meta[key] ?? null };
      return deps.sessions.setMeta(sessionId, key, value);
    },

    proposeWorktree: (reason: string) => {
      const request = deps.approvals.propose(self().id, reason);
      return { status: 'pending' as const, requestId: request.id };
    },

    openPreview: (url: string) => ({ url: deps.preview.open(self().id, normalizeUrl(url)) }),

    suggestNewTab: (url: string) => ({
      url: deps.preview.suggestNewTab(self().id, normalizeUrl(url)),
    }),

    browserNavigate: (url: string) => deps.browser.navigate(sessionId, url),
    browserOutline: () => deps.browser.outline(sessionId),
    browserScreenshot: () => deps.browser.screenshot(sessionId),
    browserClick: (target: string) => deps.browser.click(sessionId, target),
    browserFill: (target: string, text: string) => deps.browser.fill(sessionId, target, text),
    browserType: (text: string) => deps.browser.input(sessionId, { kind: 'type', text }),
    browserPress: (key: string) => deps.browser.input(sessionId, { kind: 'key', key }),
    browserScroll: (dy: number) => deps.browser.input(sessionId, { kind: 'scroll', dy }),

    requestStatus: (requestId: string) => {
      const request = deps.approvals.get(requestId);
      if (request.sessionId !== sessionId) throw notFound(`Request ${requestId}`);
      return { status: request.status, path: request.resultPath };
    },
  };
}

export type AgentTools = ReturnType<typeof createAgentTools>;
