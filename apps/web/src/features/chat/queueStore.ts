import type { ImageInput } from '@deck/shared';
import { create } from 'zustand';

export interface Queued {
  id: number;
  text: string;
  images: ImageInput[];
}

interface QueueState {
  byId: Record<string, Queued[]>;
  add(sessionId: string, text: string, images: ImageInput[]): void;
  remove(sessionId: string, id: number): void;
  /** Takes every queued message of a chat, in the order they were typed. */
  drain(sessionId: string): Queued[];
  /** Takes one queued message (to send it now). */
  take(sessionId: string, id: number): Queued | undefined;
}

let next = 1;
const EMPTY: Queued[] = [];
export const queuedOf = (sessionId: string) => (s: QueueState) => s.byId[sessionId] ?? EMPTY;

/** Messages typed while the agent was answering: held here, sent when the answer ends or when the person says so. */
export const useQueue = create<QueueState>()((set, get) => ({
  byId: {},
  add: (sessionId, text, images) =>
    set((s) => ({
      byId: {
        ...s.byId,
        [sessionId]: [...(s.byId[sessionId] ?? []), { id: next++, text, images }],
      },
    })),
  remove: (sessionId, id) =>
    set((s) => ({
      byId: { ...s.byId, [sessionId]: (s.byId[sessionId] ?? []).filter((q) => q.id !== id) },
    })),
  drain: (sessionId) => {
    const list = get().byId[sessionId] ?? [];
    if (list.length > 0) set((s) => ({ byId: { ...s.byId, [sessionId]: [] } }));
    return list;
  },
  take: (sessionId, id) => {
    const found = (get().byId[sessionId] ?? []).find((q) => q.id === id);
    if (found) get().remove(sessionId, id);
    return found;
  },
}));
