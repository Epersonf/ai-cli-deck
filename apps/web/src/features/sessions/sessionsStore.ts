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
  select(id: string): void;
  setView(view: View): void;
}

export const useSessions = create<SessionsState>()((set, get) => ({
  sessions: [],
  activeId: null,
  view: 'terminal',
  async refresh() {
    const sessions = await api.sessions();
    const { activeId } = get();
    const stillThere = sessions.some((s) => s.id === activeId);
    set({ sessions, activeId: stillThere ? activeId : (sessions[0]?.id ?? null) });
  },
  upsert(session) {
    const rest = get().sessions.filter((s) => s.id !== session.id);
    set({ sessions: [...rest, session].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) });
  },
  async remove(id) {
    await api.deleteSession(id);
    await get().refresh();
  },
  async rename(id, name) {
    get().upsert(await api.renameSession(id, name));
  },
  select: (id) => set({ activeId: id, view: 'terminal' }),
  setView: (view) => set({ view }),
}));

export const useActiveSession = (): Session | undefined =>
  useSessions((s) => s.sessions.find((x) => x.id === s.activeId));
