import type { NearbyDeck } from '@deck/shared';
import { useState, type FormEvent } from 'react';
import { networkApi } from '../../shared/api/networkApi';
import { useT } from '../../shared/i18n/store';
import { usePolling } from '../../shared/ui/usePolling';

/** How often the network is asked again while the list is open. */
const SCAN_MS = 4000;

/** Decks sharing themselves on this network, and pairing by address (another network, over a VPN). */
export function NearbyList({ onPair }: { onPair(address: string): void }) {
  const t = useT();
  const [found, setFound] = useState<NearbyDeck[] | null>(null);
  const [address, setAddress] = useState('');
  usePolling(() => networkApi.nearby().then(setFound), SCAN_MS);

  const byAddress = (event: FormEvent): void => {
    event.preventDefault();
    if (address.trim()) onPair(address.trim());
  };

  const unpaired = (found ?? []).filter((deck) => !deck.paired);
  return (
    <div className="setting">
      <h3>{t('devices.nearby')}</h3>
      {unpaired.length === 0 && <p className="hint">{t('devices.searching')}</p>}
      <ul className="peer-list">
        {unpaired.map((deck) => (
          <li key={deck.id} className="peer-row">
            <div className="peer-main">
              <span className="peer-name" title={deck.address}>
                {deck.name}
              </span>
              <span className="peer-address">{deck.address}</span>
              <button type="button" className="primary" onClick={() => onPair(deck.address)}>
                {t('devices.pair')}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <form className="field-inline" onSubmit={byAddress}>
        <input
          value={address}
          placeholder={t('devices.byAddress')}
          aria-label={t('devices.byAddress')}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setAddress(e.target.value)}
        />
        <button type="submit" disabled={!address.trim()}>
          {t('devices.pair')}
        </button>
      </form>
      <p className="hint">{t('devices.remoteHint')}</p>
    </div>
  );
}
