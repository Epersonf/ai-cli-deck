import { create } from 'zustand';

export interface Activity {
  /** Printing right now: the agent is working. */
  busy: boolean;
  /** The last line with words on the terminal's screen. */
  summary: string;
}

interface ActivityState {
  byId: Record<string, Activity>;
  set(sessionId: string, activity: Activity): void;
}

/** What each terminal is doing, as pushed by the server. */
export const useActivity = create<ActivityState>()((set) => ({
  byId: {},
  set: (sessionId, activity) => set((s) => ({ byId: { ...s.byId, [sessionId]: activity } })),
}));
