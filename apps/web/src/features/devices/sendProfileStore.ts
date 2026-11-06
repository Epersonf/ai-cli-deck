import { create } from 'zustand';

interface SendProfileState {
  profile: { id: string; label: string } | null;
  open(profile: { id: string; label: string }): void;
  close(): void;
}

/** The profile being sent to a paired device (one dialog at a time, opened from a profile's menu). */
export const useSendProfile = create<SendProfileState>()((set) => ({
  profile: null,
  open: (profile) => set({ profile }),
  close: () => set({ profile: null }),
}));
