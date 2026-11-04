import type { Session } from '@deck/shared';
import { create } from 'zustand';

interface ForkState {
  source: Session | null;
  open(session: Session): void;
  close(): void;
}

/** Which terminal the "fork or move" dialog is about (one at a time; rendered once by the app). */
export const useFork = create<ForkState>()((set) => ({
  source: null,
  open: (source) => set({ source }),
  close: () => set({ source: null }),
}));
