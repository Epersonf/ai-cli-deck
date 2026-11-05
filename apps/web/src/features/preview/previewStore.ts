import { parseLocalUrl } from '@deck/shared';
import { create } from 'zustand';

export interface PreviewState {
  history: string[];
  index: number;
  reloadKey: number;
}

/** `frame`: the page in an iframe on this device (fast). `browser`: the deck's Chromium, which the agent drives too. */
export type PreviewMode = 'frame' | 'browser';
const MODE_KEY = 'deck-preview-mode';
const savedMode = (): PreviewMode => {
  try {
    return localStorage.getItem(MODE_KEY) === 'browser' ? 'browser' : 'frame';
  } catch {
    return 'frame';
  }
};

interface PreviewStore {
  byId: Record<string, PreviewState>;
  /** Per session; a session not listed uses the mode last picked on this device. */
  mode: Record<string, PreviewMode>;
  setMode(sessionId: string, mode: PreviewMode, remember?: boolean): void;
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
    mode: {},
    setMode(sessionId, mode, remember = true) {
      set({ mode: { ...get().mode, [sessionId]: mode } });
      if (!remember) return;
      try {
        localStorage.setItem(MODE_KEY, mode);
      } catch {
        // only this page load remembers it
      }
    },
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

export const modeOf = (mode: Record<string, PreviewMode>, sessionId: string): PreviewMode =>
  mode[sessionId] ?? savedMode();
