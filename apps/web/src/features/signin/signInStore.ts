import { create } from 'zustand';

interface SignInState {
  /** The provider whose dialog is open, or null. */
  provider: string | null;
  /** Called once a sign-in or a saved key worked (the chat uses it to offer a resend). */
  onSuccess: (() => void) | null;
  open(provider: string, onSuccess?: () => void): void;
  close(): void;
}

/** One sign-in dialog for the whole app: the banner, the chat menu, `/login` and a new profile all open it. */
export const useSignIn = create<SignInState>()((set) => ({
  provider: null,
  onSuccess: null,
  open: (provider, onSuccess) => set({ provider, onSuccess: onSuccess ?? null }),
  close: () => set({ provider: null, onSuccess: null }),
}));
