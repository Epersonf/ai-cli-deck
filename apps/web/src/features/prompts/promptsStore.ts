import type { QuickPrompt } from '@deck/shared';
import { create } from 'zustand';
import { promptsApi } from '../../shared/api/reviewApi';

interface PromptsState {
  prompts: readonly QuickPrompt[];
  loaded: boolean;
  load(): Promise<void>;
  save(prompts: readonly QuickPrompt[]): Promise<void>;
}

/** The quick prompts: fetched once, saved for every device. */
export const usePrompts = create<PromptsState>()((set, get) => ({
  prompts: [],
  loaded: false,
  async load() {
    if (get().loaded) return;
    set({ prompts: await promptsApi.list(), loaded: true });
  },
  async save(prompts) {
    set({ prompts: await promptsApi.save(prompts), loaded: true });
  },
}));

/** Sends a prompt into a terminal: typed as a paste, then Enter once the program has taken it in. */
export function sendPrompt(
  prompt: QuickPrompt,
  paste: (text: string) => void,
  send: (data: string) => void,
): void {
  paste(prompt.text);
  if (prompt.enter) window.setTimeout(() => send('\r'), 120);
}
