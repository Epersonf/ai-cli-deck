import { parseLocalUrl, previewKey } from '@deck/shared';
import { create } from 'zustand';
import { PEER_ID } from '../../shared/api/base';
import {
  activeTab,
  addTab,
  closeTab,
  firstTabs,
  showMode,
  withBrowserTabs,
  type PreviewMode,
  type PreviewTabs,
} from './previewTabs';
import { shareBrowserTabs } from './tabSync';

export type { PreviewMode } from './previewTabs';

export interface PreviewState {
  history: string[];
  index: number;
  reloadKey: number;
}

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
  /** Per session; one not listed has a single tab of the mode last picked on this device (see tabsOf). */
  tabs: Record<string, PreviewTabs>;
  /** Shows the first tab of that mode, opening one when there is none. */
  setMode(sessionId: string, mode: PreviewMode, remember?: boolean): void;
  addTab(sessionId: string, mode: PreviewMode): void;
  selectTab(sessionId: string, n: number): void;
  closeTab(sessionId: string, n: number): void;
  newTab: Record<string, string | null>;
  open(sessionId: string, url: string): boolean;
  back(sessionId: string): void;
  forward(sessionId: string): void;
  reload(sessionId: string): void;
  suggestNewTab(sessionId: string, url: string | null): void;
  /** The browser tabs the deck says this session has (from another device, or on load). */
  applyServerTabs(sessionId: string, numbers: readonly number[]): void;
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
  const setTabs = (sessionId: string, fn: (tabs: PreviewTabs) => PreviewTabs): void => {
    const before = tabsOf(get().tabs, sessionId);
    const after = fn(before);
    set({ tabs: { ...get().tabs, [sessionId]: after } });
    shareBrowserTabs(sessionId, before, after);
  };
  return {
    byId: {},
    tabs: {},
    setMode(sessionId, mode, remember = true) {
      setTabs(sessionId, (tabs) => showMode(tabs, mode));
      if (!remember) return;
      try {
        localStorage.setItem(MODE_KEY, mode);
      } catch {
        // only this page load remembers it
      }
    },
    addTab: (sessionId, mode) => setTabs(sessionId, (tabs) => addTab(tabs, mode)),
    selectTab: (sessionId, n) => setTabs(sessionId, (tabs) => ({ ...tabs, active: n })),
    closeTab(sessionId, n) {
      setTabs(sessionId, (tabs) => closeTab(tabs, n));
      // A tab opened later with this number starts empty.
      const gone = previewKey(sessionId, n);
      set({ byId: Object.fromEntries(Object.entries(get().byId).filter(([key]) => key !== gone)) });
    },
    newTab: {},
    open(sessionId, url) {
      const safe = previewable(url, window.location.origin);
      if (safe === null) return false;
      // The link goes to the tab being shown.
      const key = previewKey(sessionId, activeTab(tabsOf(get().tabs, sessionId)).n);
      update(key, (s) =>
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
    applyServerTabs: (sessionId, numbers) =>
      set({
        tabs: {
          ...get().tabs,
          [sessionId]: withBrowserTabs(tabsOf(get().tabs, sessionId), numbers, firstMode()),
        },
      }),
  };
});

/** On a paired deck's app the iframe would load this device's ports, so its own browser is used. */
export const firstMode = (): PreviewMode => (PEER_ID ? 'browser' : savedMode());

/** A session's tabs: what was set, else one tab of the usual mode. */
export const tabsOf = (tabs: Record<string, PreviewTabs>, sessionId: string): PreviewTabs =>
  tabs[sessionId] ?? firstTabs(firstMode());
