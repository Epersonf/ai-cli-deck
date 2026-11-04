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
  '/api/auth': { required: false, canDisable: true, isDefault: false },
};

/** Canned answers for the endpoints the app calls while rendering. */
export function fakeApi(url: string): Response {
  const empty = url.includes('/tree')
    ? { entries: [] }
    : { isRepo: false, branch: null, changes: [] };
  return new Response(JSON.stringify(ROUTES[url] ?? empty), { status: 200 });
}
