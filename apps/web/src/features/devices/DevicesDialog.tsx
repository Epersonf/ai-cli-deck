import { useEffect, useState } from 'react';
import { useT } from '../../shared/i18n/store';
import { ModalTitle } from '../../shared/ui/ModalTitle';
import { usePolling } from '../../shared/ui/usePolling';
import { NearbyList } from './NearbyList';
import { PairDialog } from './PairDialog';
import { PeerList } from './PeerList';
import { SharingSection } from './SharingSection';
import { useNetwork } from './networkStore';

/** Other decks: share this one, pair, and open a paired deck (your PC, from your phone). */
export function DevicesDialog({ onClose }: { onClose(): void }) {
  const t = useT();
  const [pairing, setPairing] = useState<string | null>(null);
  const refresh = (): Promise<void> => useNetwork.getState().refresh();
  usePolling(refresh, 5000);
  useEffect(() => void refresh().catch(() => undefined), []);

  if (pairing !== null) {
    return (
      <PairDialog
        address={pairing}
        onPaired={() => (setPairing(null), void refresh().catch(() => undefined))}
        onClose={() => setPairing(null)}
      />
    );
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal devices" onClick={(e) => e.stopPropagation()}>
        <ModalTitle title={t('devices.title')} onClose={onClose} />
        <p className="hint">{t('devices.hint')}</p>
        <PeerList />
        <NearbyList onPair={setPairing} />
        <SharingSection />
      </div>
    </div>
  );
}
