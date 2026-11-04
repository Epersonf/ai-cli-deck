import type { ProviderInfo, TemplateInfo } from '@deck/shared';
import { create } from 'zustand';
import { api } from '../../shared/api/endpoints';

interface ProfilesState {
  /** Every launchable entry: built-in CLIs, configured ones and user profiles. */
  providers: ProviderInfo[];
  /** What profiles can be made from: the built-in templates plus imported ones. */
  templates: TemplateInfo[];
  refresh(): Promise<void>;
  refreshTemplates(): Promise<void>;
}

export const useProfiles = create<ProfilesState>()((set) => ({
  providers: [],
  templates: [],
  async refresh() {
    set({ providers: await api.providers() });
  },
  async refreshTemplates() {
    set({ templates: await api.templates() });
  },
}));
