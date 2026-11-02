import { create } from 'zustand';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm(): void;
}

interface ConfirmState {
  request: ConfirmRequest | null;
  ask(request: ConfirmRequest): void;
  dismiss(): void;
}

/** One app-styled confirmation at a time, replacing the browser's window.confirm. */
export const useConfirm = create<ConfirmState>()((set) => ({
  request: null,
  ask: (request) => set({ request }),
  dismiss: () => set({ request: null }),
}));
