import { create } from 'zustand';

const SHOW_MS = 1500;

interface ToastState {
  text: string | null;
  show(text: string): void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** One short message at a time, gone by itself: "Copied", "Saved"... */
export const useToast = create<ToastState>()((set) => ({
  text: null,
  show(text) {
    clearTimeout(timer);
    set({ text });
    timer = setTimeout(() => set({ text: null }), SHOW_MS);
  },
}));

export const toast = (text: string): void => useToast.getState().show(text);

/** Where the message appears (rendered once, by the app). Leaves nothing behind when it goes. */
export function ToastHost() {
  const text = useToast((s) => s.text);
  if (text === null) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      {text}
    </div>
  );
}
