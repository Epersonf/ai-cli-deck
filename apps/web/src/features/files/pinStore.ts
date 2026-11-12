import { create } from 'zustand';

const KEY = 'deck-pinned-from';

const load = (): Record<string, string> => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (typeof parsed !== 'object' || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
  } catch {
    return {};
  }
};

const save = (from: Record<string, string>): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(from));
  } catch {
    // only this page load remembers it
  }
};

interface PinState {
  /** Per session: the base folder it had before it was pinned to a sub-folder (so it can be unpinned). */
  from: Record<string, string>;
  pin(sessionId: string, previousBase: string): void;
  unpin(sessionId: string): void;
}

export const usePins = create<PinState>()((set, get) => ({
  from: load(),
  pin(sessionId, previousBase) {
    // Pinning again keeps the first base: unpinning goes back to where it all began.
    const from = { ...get().from, [sessionId]: get().from[sessionId] ?? previousBase };
    save(from);
    set({ from });
  },
  unpin(sessionId) {
    const from = Object.fromEntries(Object.entries(get().from).filter(([id]) => id !== sessionId));
    save(from);
    set({ from });
  },
}));
