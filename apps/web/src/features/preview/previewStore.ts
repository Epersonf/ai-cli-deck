import { parseLocalUrl } from '@deck/shared';
import { create } from 'zustand';

export interface PreviewState {
  history: string[];
  index: number;
  reloadKey: number;
}

interface PreviewStore {
  byId: Record<string, PreviewState>;
  newTab: Record<string, string | null>;
  open(sessionId: string, url: string): boolean;
  back(sessionId: string): void;
  forward(sessionId: string): void;
  reload(sessionId: string): void;
  suggestNewTab(sessionId: string, url: string | null): void;
}

const EMPTY: PreviewState = { history: [], index: -1, reloadKey: 0 };
export const currentUrl = (state: PreviewState | undefined): string | null =>
  state?.history[state.index] ?? null;

/** Localhost only, and never the deck itself (an embedded deck could escape the sandbox). */
export function previewable(url: string, deckOrigin: string): string | null {
  const safe = parseLocalUrl(url);
  if (safe === null) return null;
  return new URL(safe).origin === deckOrigin ? null : safe;
}

export const usePreview = create<PreviewStore>()((set, get) => {
  const update = (id: string, fn: (s: PreviewState) => PreviewState): void =>
    set({ byId: { ...get().byId, [id]: fn(get().byId[id] ?? EMPTY) } });
  return {
    byId: {},
    newTab: {},
    open(sessionId, url) {
      const safe = previewable(url, window.location.origin);
      if (safe === null) return false;
      update(sessionId, (s) =>
        s.history[s.index] === safe
          ? s
          : { ...s, history: [...s.history.slice(0, s.index + 1), safe], index: s.index + 1 },
      );
      return true;
    },
    back: (id) => update(id, (s) => ({ ...s, index: Math.max(s.index - 1, 0) })),
    forward: (id) =>
      update(id, (s) => ({ ...s, index: Math.min(s.index + 1, s.history.length - 1) })),
    reload: (id) => update(id, (s) => ({ ...s, reloadKey: s.reloadKey + 1 })),
    suggestNewTab: (id, url) => set({ newTab: { ...get().newTab, [id]: url } }),
  };
});
