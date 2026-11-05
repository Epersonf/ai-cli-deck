import { create } from 'zustand';

interface SearchState {
  /** The terminal whose search box is open (one at a time). */
  openFor: string | null;
  toggle(sessionId: string): void;
  close(): void;
}

/** Opened from the top bar or Ctrl+Shift+F; the search box floats over that terminal. */
export const useTerminalSearch = create<SearchState>()((set, get) => ({
  openFor: null,
  toggle: (sessionId) => set({ openFor: get().openFor === sessionId ? null : sessionId }),
  close: () => set({ openFor: null }),
}));
