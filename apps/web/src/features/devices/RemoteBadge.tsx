import { useEffect, useState } from 'react';
import { PEER_ID } from '../../shared/api/base';
import { networkApi } from '../../shared/api/networkApi';
import { useT } from '../../shared/i18n/store';
import { RemoteIcon } from '../../shared/ui/GlyphIcons';

/** On a paired deck's app: which deck this is, and the way back to the one in your hand. */
export function RemoteBadge() {
  const t = useT();
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    if (!PEER_ID) return;
    networkApi
      .peers()
      .then((peers) => setName(peers.find((p) => p.id === PEER_ID)?.name ?? null))
      .catch(() => undefined);
  }, []);
  if (!PEER_ID) return null;
  return (
    <a className="remote-badge" href="/" title={t('devices.back')}>
      <RemoteIcon size={16} /> {t('devices.remote', { name: name ?? '…' })}
    </a>
  );
}
