import type { Session } from '@deck/shared';
import { useEffect, useRef } from 'react';
import { api } from '../../shared/api/endpoints';
import { usePolling } from '../../shared/ui/usePolling';
import { toWatch, useAutoNotify } from './autoNotify';
import { useTasks } from './tasksStore';

/**
 * While "tell me when an agent goes quiet" is on, every agent terminal is watched as if its menu entry had been
 * ticked: the deck then notifies the phone when it stops printing (the agent finished, or waits for you).
 */
export function useAutoNotifyWatch(paused: boolean, sessions: readonly Session[]): void {
  const on = useAutoNotify((s) => s.on);
  const tried = useRef(new Set<string>());
  const latest = useRef(sessions);
  latest.current = sessions;
  // Turning it off and on again retries what could not be watched (phone access was off, say).
  useEffect(() => tried.current.clear(), [on]);

  usePolling(async () => {
    if (!on || paused) return;
    await useTasks.getState().refresh();
    for (const id of toWatch(latest.current, useTasks.getState().tasks, tried.current)) {
      tried.current.add(id);
      await api.notifyIdle(id, true).catch(() => undefined);
    }
  }, 15_000);
}
