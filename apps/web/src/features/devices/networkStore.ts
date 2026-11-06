import type { NetworkStatus, PeerInfo } from '@deck/shared';
import { create } from 'zustand';
import { PEER_ID } from '../../shared/api/base';
import { networkApi } from '../../shared/api/networkApi';

interface NetworkStore {
  status: NetworkStatus | null;
  peers: PeerInfo[];
  refresh(): Promise<void>;
  setStatus(status: NetworkStatus): void;
}

/** This deck's sharing state and its paired decks (nothing on a paired deck's app: it is not ours). */
export const useNetwork = create<NetworkStore>()((set) => ({
  status: null,
  peers: [],
  async refresh() {
    if (PEER_ID) return;
    const [status, peers] = await Promise.all([networkApi.status(), networkApi.peers()]);
    set({ status, peers });
  },
  setStatus: (status) => set({ status }),
}));
