import { create } from 'zustand';

interface DraftState {
  byId: Record<string, string>;
  set(sessionId: string, text: string): void;
  /** Adds words to the end of the chat's draft (a file mentioned from the explorer), with a space around them. */
  insert(sessionId: string, snippet: string): void;
}

/** What is typed in each chat's message box, kept when you switch chats and reachable from other screens. */
export const useDraft = create<DraftState>()((set) => ({
  byId: {},
  set: (sessionId, text) => set((s) => ({ byId: { ...s.byId, [sessionId]: text } })),
  insert: (sessionId, snippet) =>
    set((s) => {
      const now = s.byId[sessionId] ?? '';
      const gap = now === '' || /\s$/.test(now) ? '' : ' ';
      return { byId: { ...s.byId, [sessionId]: `${now}${gap}${snippet} ` } };
    }),
}));

export const draftOf = (sessionId: string) => (s: DraftState) => s.byId[sessionId] ?? '';
