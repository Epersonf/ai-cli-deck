import { useEffect, useRef } from 'react';
import { shortcutFor, targetSession } from './shortcuts';

/** Window-level terminal switching; runs in the capture phase so xterm never swallows it. */
export function useShortcuts(
  ids: readonly string[],
  activeId: string | null,
  onSelect: (id: string) => void,
): void {
  const latest = useRef({ ids, activeId, onSelect });
  latest.current = { ids, activeId, onSelect };
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const action = shortcutFor(event);
      if (!action) return;
      const target = targetSession(action, latest.current.ids, latest.current.activeId);
      if (target === null) return;
      event.preventDefault();
      event.stopPropagation();
      latest.current.onSelect(target);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);
}
