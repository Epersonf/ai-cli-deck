import { create } from 'zustand';
import { useSessions } from '../sessions/sessionsStore';
import {
  clampRatio,
  loadLayout,
  saveLayout,
  type LayoutPref,
  type RightView,
} from './layoutPreference';

interface LayoutState {
  layout: LayoutPref;
  patch(change: Partial<LayoutPref>): void;
}

export const useLayout = create<LayoutState>()((set, get) => ({
  layout: loadLayout(),
  patch(change) {
    const merged = { ...get().layout, ...change };
    const next = { ...merged, ratio: clampRatio(merged.ratio) };
    saveLayout(next);
    set({ layout: next });
  },
}));

/** Brings a side pane into view on any screen size (wide: opens the split; narrow: switches tab). */
export function showSidePane(view: RightView): void {
  useLayout.getState().patch({ showRight: true, rightView: view });
  useSessions.getState().setView(view);
}
