import { create } from 'zustand';

const KEY = 'deck-options-bar';

const initial = (): boolean => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) return saved === 'open';
  } catch {
    // no storage: use the default
  }
  // Open on a wide screen; on a phone the chat keeps the room.
  return window.matchMedia?.('(min-width: 700px)').matches ?? true;
};

interface BarState {
  open: boolean;
  set(open: boolean): void;
}

const useBar = create<BarState>((set) => ({
  open: initial(),
  set: (open) => {
    set({ open });
    try {
      localStorage.setItem(KEY, open ? 'open' : 'closed');
    } catch {
      // only this page load remembers it
    }
  },
}));

/** Whether the mode / model / effort bar is open; shared by the bar and its toggle, remembered per device. */
export function useBarOpen(): readonly [boolean, (open: boolean) => void] {
  const open = useBar((s) => s.open);
  const set = useBar((s) => s.set);
  return [open, set] as const;
}
