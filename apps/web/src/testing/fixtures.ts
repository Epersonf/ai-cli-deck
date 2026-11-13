import type { Session } from '@deck/shared';

export const makeSession = (id: string, cwd: string, provider = 'claude'): Session => ({
  id,
  provider,
  cwd,
  status: 'idle',
  createdAt: `2026-01-0${id.slice(1)}T00:00:00Z`,
  lastMessageAt: null,
  previewUrl: null,
  port: 4100,
  worktree: { enabled: false, path: null, branch: null },
  sharedCwdWith: [],
  name: null,
  parentId: null,
  meta: {},
});

export const SESSIONS = [makeSession('s1', '/work/alpha'), makeSession('s2', '/work/beta')];

const ROUTES: Record<string, unknown> = {
  '/api/config': { defaultCwd: '/root' },
  '/api/sessions': SESSIONS,
  '/api/approvals?status=pending': [],
  '/api/providers': [
    { id: 'claude', label: 'Claude Code', status: 'ready', hint: null, canInstall: false },
    { id: 'work', label: 'Work', status: 'ready', hint: null, canInstall: false, profile: true },
  ],
  '/api/templates': [
    { schema: 1, id: 'claude', label: 'Claude Code', agent: 'claude', builtin: true },
    {
      schema: 1,
      id: 'claude-endpoint',
      label: 'Claude Code (custom endpoint)',
      agent: 'claude',
      builtin: true,
      fields: [{ key: 'baseUrl', label: 'API base URL', type: 'url', required: true }],
      apiKey: { env: 'ANTHROPIC_AUTH_TOKEN', label: 'API key', required: true },
    },
    {
      schema: 1,
      id: 'claude-deepseek',
      label: 'Claude Code (DeepSeek)',
      agent: 'claude',
      builtin: true,
    },
    { schema: 1, id: 'codex', label: 'Codex', agent: 'codex', builtin: true },
  ],
  '/api/tasks': [],
  '/api/chats/titles': {},
  '/api/auth': { required: false, canDisable: true, isDefault: false },
};

/** Canned answers for the endpoints the app calls while rendering. */
export function fakeApi(url: string): Response {
  const empty = url.includes('/tree')
    ? { entries: [] }
    : { isRepo: false, branch: null, changes: [] };
  return new Response(JSON.stringify(ROUTES[url] ?? empty), { status: 200 });
}
