import type { Session } from '@deck/shared';
import { create } from 'zustand';
import { api } from '../../shared/api/endpoints';
import { useSessions } from '../sessions/sessionsStore';

interface SideState {
  /** Side chats whose pane is open (by the side chat's session id). */
  open: Record<string, boolean>;
  setOpen(childId: string, open: boolean): void;
  /** Opens the main chat's side chat, creating it the first time. */
  start(parentId: string): Promise<void>;
}

/** The side chats of a main session (a child session each), newest last. */
export const sideChatsOf = (sessions: readonly Session[], parentId: string): Session[] =>
  sessions
    .filter((s) => s.parentId === parentId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

export const useSide = create<SideState>()((set) => ({
  open: {},
  setOpen: (childId, open) => set((s) => ({ open: { ...s.open, [childId]: open } })),
  async start(parentId) {
    const sessions = useSessions.getState();
    const existing = sideChatsOf(sessions.sessions, parentId).at(-1);
    if (existing) return set((s) => ({ open: { ...s.open, [existing.id]: true } }));
    const child = await api.openSide(parentId);
    sessions.upsert(child);
    set((s) => ({ open: { ...s.open, [child.id]: true } }));
  },
}));
