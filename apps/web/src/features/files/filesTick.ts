import { create } from 'zustand';

interface TickState {
  byId: Record<string, number>;
  bump(sessionId: string): void;
}

/** Counts "the agent may have changed files" per session; the file list and git review reload when it moves. */
export const useFilesTick = create<TickState>()((set) => ({
  byId: {},
  bump: (id) => set((s) => ({ byId: { ...s.byId, [id]: (s.byId[id] ?? 0) + 1 } })),
}));

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** A tool finished or a turn ended: reload soon (a burst of tool results reloads once). */
export function filesMayHaveChanged(sessionId: string, delayMs = 400): void {
  clearTimeout(timers.get(sessionId));
  timers.set(
    sessionId,
    setTimeout(() => {
      timers.delete(sessionId);
      useFilesTick.getState().bump(sessionId);
    }, delayMs),
  );
}
