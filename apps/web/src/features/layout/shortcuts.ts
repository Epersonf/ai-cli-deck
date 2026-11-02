export interface KeyLike {
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export type ShortcutAction = { kind: 'select'; index: number } | { kind: 'step'; delta: 1 | -1 };

/** Alt+1..9 picks a terminal; Alt+[ and Alt+] step back and forward. Uses `code`, so it works on any layout. */
export function shortcutFor(event: KeyLike): ShortcutAction | null {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  const digit = /^Digit([1-9])$/.exec(event.code);
  if (digit) return { kind: 'select', index: Number(digit[1]) - 1 };
  if (event.code === 'BracketLeft') return { kind: 'step', delta: -1 };
  if (event.code === 'BracketRight') return { kind: 'step', delta: 1 };
  return null;
}

/** The session id the shortcut leads to, wrapping around at the ends. */
export function targetSession(
  action: ShortcutAction,
  ids: readonly string[],
  activeId: string | null,
): string | null {
  if (ids.length === 0) return null;
  if (action.kind === 'select') return ids[action.index] ?? null;
  const at = Math.max(ids.indexOf(activeId ?? ''), 0);
  return ids[(at + action.delta + ids.length) % ids.length] ?? null;
}
