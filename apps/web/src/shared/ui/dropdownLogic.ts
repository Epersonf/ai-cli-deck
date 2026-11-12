import type { CSSProperties, KeyboardEvent } from 'react';

export const NARROW = 640;
const GAP = 6;

/** Where the popover goes: under the plate, or over it when there is more room above; clamped to the screen. */
export function placePopover(trigger: HTMLElement): CSSProperties {
  const r = trigger.getBoundingClientRect();
  const below = window.innerHeight - r.bottom - GAP - 8;
  const above = r.top - GAP - 8;
  const up = below < 300 && above > below;
  const width = Math.max(r.width, 300);
  const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
  const maxHeight = Math.min(window.innerHeight * 0.7, up ? above : below);
  return up
    ? { left, width, maxHeight, bottom: window.innerHeight - r.top + GAP }
    : { left, width, maxHeight, top: r.bottom + GAP };
}

export interface TypeAhead {
  text: string;
  at: number;
}

/**
 * The index a key moves the active row to (arrows, Home, End, type-ahead by label), or null when the key is
 * not a navigation key. `typed` remembers the letters of a quick burst.
 */
export function nextActive(
  e: KeyboardEvent,
  labels: readonly string[],
  active: number,
  typed: { current: TypeAhead },
): number | null {
  const last = labels.length - 1;
  if (e.key === 'ArrowDown') return Math.min(active + 1, last);
  if (e.key === 'ArrowUp') return Math.max(active - 1, 0);
  if (e.key === 'Home') return 0;
  if (e.key === 'End') return last;
  if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.key === ' ') return null;
  const now = Date.now();
  const text = (now - typed.current.at > 600 ? '' : typed.current.text) + e.key.toLowerCase();
  typed.current = { text, at: now };
  const at = labels.findIndex((l) => l.toLowerCase().startsWith(text));
  return at >= 0 ? at : active;
}
