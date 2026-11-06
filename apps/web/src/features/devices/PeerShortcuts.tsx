import { openPeer } from '../../shared/api/networkApi';
import { useT } from '../../shared/i18n/store';
import { useNetwork } from './networkStore';

/** Paired decks in the terminals drawer: one tap to use the PC from the phone. */
export function PeerShortcuts() {
  const t = useT();
  const peers = useNetwork((s) => s.peers);
  if (peers.length === 0) return null;
  return (
    <div className="peer-shortcuts">
      <h3>{t('devices.paired')}</h3>
      {peers.map((peer) => (
        <button key={peer.id} type="button" onClick={() => openPeer(peer.id)}>
          <span className={`peer-dot${peer.online ? ' on' : ''}`} aria-hidden />
          <span className="peer-name">{peer.name}</span>
          <span aria-hidden>→</span>
        </button>
      ))}
    </div>
  );
}
