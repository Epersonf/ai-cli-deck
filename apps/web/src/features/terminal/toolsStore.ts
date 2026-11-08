import { create } from 'zustand';

export type ToolTab = 'search' | 'copy';

interface ToolsState {
  /** The terminal whose tools bar is open, if any. */
  openFor: string | null;
  tab: ToolTab;
  /** The terminal showing its text for selection (a phone cannot select inside the terminal canvas). */
  selecting: string | null;
  /** Opens the bar (on `tab`, or the last one used); closes it when that tab is already showing. */
  toggle(sessionId: string, tab?: ToolTab): void;
  setTab(tab: ToolTab): void;
  select(sessionId: string | null): void;
  close(): void;
}

export const useTerminalTools = create<ToolsState>()((set, get) => ({
  openFor: null,
  tab: 'search',
  selecting: null,
  toggle: (sessionId, tab) => {
    const { openFor, tab: current } = get();
    if (openFor === sessionId && (tab === undefined || tab === current)) set({ openFor: null });
    else set({ openFor: sessionId, tab: tab ?? current });
  },
  setTab: (tab) => set({ tab }),
  select: (sessionId) => set({ selecting: sessionId }),
  close: () => set({ openFor: null }),
}));
