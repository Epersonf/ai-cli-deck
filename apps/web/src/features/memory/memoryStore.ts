import type { MemoryScope, MemoryTree } from '@deck/shared';
import { create } from 'zustand';
import { memoryApi } from '../../shared/api/memoryApi';

export const treeKey = (scope: MemoryScope, profileId: string | null): string =>
  scope === 'global' ? 'global' : `profile:${profileId ?? ''}`;

interface MemoryState {
  /** The memory screen is open (and for which profile its "This profile" tab starts). */
  open: boolean;
  profileId: string | null;
  /** Opened from Settings: the back button returns there. */
  fromSettings: boolean;
  trees: Record<string, MemoryTree>;
  show(profileId: string | null, fromSettings?: boolean): void;
  hide(): void;
  /** Fetches one scope's tree (also when the deck says it changed). */
  load(scope: MemoryScope, profileId: string | null): Promise<void>;
  /** The deck says memory changed: reload what is on screen. */
  changed(scope: MemoryScope, profileId: string | null): void;
  set(scope: MemoryScope, profileId: string | null, tree: MemoryTree): void;
}

export const useMemory = create<MemoryState>()((set, get) => ({
  open: false,
  profileId: null,
  fromSettings: false,
  trees: {},
  show: (profileId, fromSettings = false) => set({ open: true, profileId, fromSettings }),
  hide: () => set({ open: false }),
  async load(scope, profileId) {
    const tree = await memoryApi.tree(scope, profileId);
    get().set(scope, profileId, tree);
  },
  changed(scope, profileId) {
    const key = treeKey(scope, profileId);
    if (get().open && key in get().trees)
      void get()
        .load(scope, profileId)
        .catch(() => undefined);
  },
  set: (scope, profileId, tree) =>
    set({ trees: { ...get().trees, [treeKey(scope, profileId)]: tree } }),
}));
