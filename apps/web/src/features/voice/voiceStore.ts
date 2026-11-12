import { create } from 'zustand';
import { voiceApi, type VoiceStatus } from './voiceApi';

const KEY = 'deck-voice';

interface Prefs {
  /** A transcribed message is sent at once instead of landing in the box. */
  conversation: boolean;
  /** Finished answers are read aloud. */
  speak: boolean;
}

const load = (): Prefs => {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const prefs = raw as Partial<Prefs>;
    return { conversation: prefs.conversation === true, speak: prefs.speak === true };
  } catch {
    return { conversation: false, speak: false };
  }
};

interface VoiceState extends Prefs {
  /** Null until the server was asked. */
  status: VoiceStatus | null;
  refresh(): Promise<void>;
  /** Starts the model download and follows it until it ends. */
  prepare(): Promise<void>;
  set(change: Partial<Prefs>): void;
}

const POLL_MS = 2000;

export const useVoice = create<VoiceState>()((set, get) => ({
  ...load(),
  status: null,
  async refresh() {
    set({
      status: await voiceApi
        .status()
        .catch(() => ({ supported: false, ready: false, downloading: false })),
    });
  },
  async prepare() {
    set({ status: await voiceApi.prepare() });
    while (get().status?.downloading) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      await get().refresh();
    }
  },
  set(change) {
    set(change);
    try {
      const { conversation, speak } = get();
      localStorage.setItem(KEY, JSON.stringify({ conversation, speak }));
    } catch {
      // only this page load remembers it
    }
  },
}));
