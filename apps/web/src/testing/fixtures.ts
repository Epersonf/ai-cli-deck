import type { Session } from '@deck/shared';

export const makeSession = (id: string, cwd: string, provider = 'shell'): Session => ({
  id,
  provider,
  cwd,
  status: 'running',
  createdAt: `2026-01-0${id.slice(1)}T00:00:00Z`,
  previewUrl: null,
  port: 4100,
  worktree: { enabled: false, path: null, branch: null },
  persistent: true,
  sharedCwdWith: [],
  name: null,
  parentId: null,
  meta: {},
});

export const SESSIONS = [makeSession('s1', '/work/alpha'), makeSession('s2', '/work/beta')];

const ROUTES: Record<string, unknown> = {
  '/api/config': { defaultCwd: '/root', extraKeys: null, persistent: true },
  '/api/sessions': SESSIONS,
  '/api/approvals?status=pending': [],
  '/api/providers': [
    { id: 'shell', label: 'Shell', status: 'ready', hint: null, canInstall: false },
    { id: 'work', label: 'Work', status: 'ready', hint: null, canInstall: false, profile: true },
  ],
  '/api/templates': [
    { schema: 1, id: 'claude', label: 'Claude Code', builtin: true },
    {
      schema: 1,
      id: 'claude-endpoint',
      label: 'Claude Code (custom endpoint)',
      builtin: true,
      fields: [{ key: 'baseUrl', label: 'API base URL', type: 'url', required: true }],
    },
    { schema: 1, id: 'claude-deepseek', label: 'Claude Code (DeepSeek)', builtin: true },
    { schema: 1, id: 'codex', label: 'Codex', builtin: true },
    {
      schema: 1,
      id: 'custom',
      label: 'Custom command',
      builtin: true,
      fields: [{ key: 'command', label: 'Program', required: false }],
    },
  ],
  '/api/tasks': [],
  '/api/auth': { required: false, canDisable: true, isDefault: false },
};

/** Canned answers for the endpoints the app calls while rendering. */
export function fakeApi(url: string): Response {
  const empty = url.includes('/tree')
    ? { entries: [] }
    : { isRepo: false, branch: null, changes: [] };
  return new Response(JSON.stringify(ROUTES[url] ?? empty), { status: 200 });
}
