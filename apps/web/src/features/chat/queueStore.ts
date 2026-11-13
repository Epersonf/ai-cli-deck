import { create } from 'zustand';

export interface Queued {
  id: string;
  text: string;
  /** How many pictures or PDFs go with it. */
  images: number;
}

interface QueueState {
  byId: Record<string, Queued[]>;
  /** The server's list of waiting messages for a chat (the same on every device). */
  set(sessionId: string, items: Queued[]): void;
}

const EMPTY: Queued[] = [];
export const queuedOf = (sessionId: string) => (s: QueueState) => s.byId[sessionId] ?? EMPTY;

/** Messages typed while the agent was answering. They live on the server, so every device shows the same list. */
export const useQueue = create<QueueState>()((set) => ({
  byId: {},
  set: (sessionId, items) => set((s) => ({ byId: { ...s.byId, [sessionId]: items } })),
}));
