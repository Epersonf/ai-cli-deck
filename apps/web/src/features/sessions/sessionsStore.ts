import type { Session } from '@deck/shared';
import { create } from 'zustand';
import { api } from '../../shared/api/endpoints';

export type View = 'terminal' | 'files' | 'changes' | 'preview';

interface SessionsState {
  sessions: Session[];
  activeId: string | null;
  view: View;
  refresh(): Promise<void>;
  upsert(session: Session): void;
  remove(id: string): Promise<void>;
  rename(id: string, name: string | null): Promise<void>;
  /** Bases the session in another folder (Files, git and chats follow). */
  setFolder(id: string, path: string): Promise<void>;
  select(id: string): void;
  setView(view: View): void;
}

const newestFirst = (list: Session[]): Session[] =>
  [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export const useSessions = create<SessionsState>()((set, get) => ({
  sessions: [],
  activeId: null,
  view: 'terminal',
  async refresh() {
    const sessions = newestFirst(await api.sessions());
    const { activeId } = get();
    const stillThere = sessions.some((s) => s.id === activeId);
    set({ sessions, activeId: stillThere ? activeId : (sessions[0]?.id ?? null) });
  },
  upsert(session) {
    const rest = get().sessions.filter((s) => s.id !== session.id);
    set({ sessions: newestFirst([...rest, session]) });
  },
  async remove(id) {
    await api.deleteSession(id);
    await get().refresh();
  },
  async setFolder(id, path) {
    get().upsert(await api.setSessionFolder(id, path));
  },
  async rename(id, name) {
    get().upsert(await api.renameSession(id, name));
  },
  select: (id) => set({ activeId: id, view: 'terminal' }),
  setView: (view) => set({ view }),
}));

export const useActiveSession = (): Session | undefined =>
  useSessions((s) => s.sessions.find((x) => x.id === s.activeId));
