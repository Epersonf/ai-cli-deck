import { useState } from 'react';

const KEY = 'deck-options-bar';

const initial = (): boolean => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) return saved === 'open';
  } catch {
    // no storage: use the default
  }
  // Open on a wide screen; on a phone the one-line summary leaves the room to the chat.
  return window.matchMedia?.('(min-width: 700px)').matches ?? true;
};

/** Whether the mode / model / effort bar is open; remembered per device. */
export function useBarOpen(): readonly [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(initial);
  const set = (next: boolean): void => {
    setOpen(next);
    try {
      localStorage.setItem(KEY, next ? 'open' : 'closed');
    } catch {
      // only this page load remembers it
    }
  };
  return [open, set] as const;
}
