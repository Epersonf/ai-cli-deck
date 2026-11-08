import { create } from 'zustand';
import { api } from '../../shared/api/endpoints';

interface TitlesState {
  /** The automatic name of a terminal, by session id: the first thing asked in its chat. */
  titles: Record<string, string>;
  refresh(): Promise<void>;
}

export const useChatTitles = create<TitlesState>()((set) => ({
  titles: {},
  async refresh() {
    set({ titles: await api.chatTitles() });
  },
}));
