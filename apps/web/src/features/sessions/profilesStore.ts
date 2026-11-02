import type { ProviderInfo } from '@deck/shared';
import { create } from 'zustand';
import { api } from '../../shared/api/endpoints';

interface ProfilesState {
  /** Every launchable entry: built-in CLIs, configured ones and user profiles. */
  providers: ProviderInfo[];
  refresh(): Promise<void>;
}

export const useProfiles = create<ProfilesState>()((set) => ({
  providers: [],
  async refresh() {
    set({ providers: await api.providers() });
  },
}));
