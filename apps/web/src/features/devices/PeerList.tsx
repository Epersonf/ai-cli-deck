import type { PeerInfo } from '@deck/shared';
import { useState } from 'react';
import { networkApi, openPeer } from '../../shared/api/networkApi';
import { useT } from '../../shared/i18n/store';
import { useConfirm } from '../confirm/confirmStore';
import { useNetwork } from './networkStore';

/** One paired deck: open its app, give it another address (a VPN's), or unpair it. */
function PeerRow({ peer, onChange }: { peer: PeerInfo; onChange(): void }) {
  const t = useT();
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const forget = (): void =>
    useConfirm.getState().ask({
      title: t('devices.forget'),
      message: t('devices.forgetBody', { name: peer.name }),
      confirmLabel: t('devices.forget'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => void networkApi.forget(peer.id).then(onChange),
    });
  const add = (): void => {
    if (!address?.trim()) return setAddress(null);
    networkApi
      .addAddress(peer.id, address.trim())
      .then(() => (setAddress(null), setError(null), onChange()))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'failed'));
  };
  return (
    <li className="peer-row">
      <div className="peer-main">
        <span className={`peer-dot${peer.online ? ' on' : ''}`} aria-hidden />
        <span className="peer-name" title={peer.addresses.join(', ')}>
          {peer.name}
        </span>
        <button type="button" className="primary" onClick={() => openPeer(peer.id)}>
          {t('devices.useIt')}
        </button>
      </div>
      <div className="peer-tools">
        <button type="button" onClick={() => setAddress(address === null ? '' : null)}>
          {t('devices.addAddress')}
        </button>
        <button type="button" className="danger" onClick={forget}>
          {t('devices.forget')}
        </button>
      </div>
      {address !== null && (
        <form className="field-inline" onSubmit={(e) => (e.preventDefault(), add())}>
          <input
            value={address}
            autoFocus
            placeholder="100.64.0.2:7850"
            onChange={(e) => setAddress(e.target.value)}
          />
          <button type="submit">{t('common.save')}</button>
        </form>
      )}
      {error !== null && <p className="notice error">{error}</p>}
    </li>
  );
}

/** The decks this one paired with. */
export function PeerList() {
  const t = useT();
  const peers = useNetwork((s) => s.peers);
  const refresh = (): void =>
    void useNetwork
      .getState()
      .refresh()
      .catch(() => undefined);
  return (
    <div className="setting">
      <h3>{t('devices.paired')}</h3>
      {peers.length === 0 ? (
        <p className="hint">{t('devices.none')}</p>
      ) : (
        <ul className="peer-list">
          {peers.map((peer) => (
            <PeerRow key={peer.id} peer={peer} onChange={refresh} />
          ))}
        </ul>
      )}
    </div>
  );
}
