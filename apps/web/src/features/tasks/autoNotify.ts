import type { Session, Task } from '@deck/shared';
import { create } from 'zustand';
import { idleWatcher } from './tasksStore';

const KEY = 'deck-auto-notify';

const load = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

interface AutoNotifyState {
  /** Watch every agent terminal and notify the phone when one goes quiet. Per device, off by default. */
  on: boolean;
  set(on: boolean): void;
}

export const useAutoNotify = create<AutoNotifyState>()((set) => ({
  on: load(),
  set(on) {
    try {
      localStorage.setItem(KEY, on ? '1' : '0');
    } catch {
      // only this page load remembers it
    }
    set({ on });
  },
}));

/**
 * The terminals to start watching: agent terminals (a plain shell is quiet all the time) that are running,
 * not watched yet, and not already tried (a terminal that could not be watched is not retried every poll).
 */
export function toWatch(
  sessions: readonly Session[],
  tasks: readonly Task[],
  tried: ReadonlySet<string>,
): string[] {
  return sessions
    .filter(
      (s) =>
        s.parentId === null &&
        s.provider !== 'shell' &&
        s.status === 'running' &&
        !tried.has(s.id) &&
        idleWatcher(tasks, s.id) === undefined,
    )
    .map((s) => s.id);
}
