import { DEFAULT_PEER_PORT } from '@deck/shared';
import { useEffect, useState } from 'react';
import { networkApi } from '../../shared/api/networkApi';
import { useT } from '../../shared/i18n/store';
import { useConfirm } from '../confirm/confirmStore';
import { useNetwork } from './networkStore';

/** The switch that makes this deck visible and usable by paired decks, and the name they see. */
export function SharingSection() {
  const t = useT();
  const status = useNetwork((s) => s.status);
  const setStatus = useNetwork((s) => s.setStatus);
  const [name, setName] = useState(status?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setName(status?.name ?? ''), [status?.name]);
  if (!status) return null;

  const apply = (body: { sharing?: boolean; name?: string }): void =>
    void networkApi
      .update(body)
      .then((next) => (setStatus(next), setError(null)))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'failed'));

  /** Turning sharing on asks twice: it lets other machines use this one. */
  const turnOn = (): void => {
    const { ask } = useConfirm.getState();
    const port = String(status.port ?? DEFAULT_PEER_PORT);
    ask({
      title: t('devices.warnTitle'),
      message: t('devices.warnBody'),
      confirmLabel: t('devices.warnNext'),
      cancelLabel: t('common.cancel'),
      onConfirm: () =>
        ask({
          title: t('devices.sureTitle'),
          message: t('devices.sureBody', { port }),
          confirmLabel: t('devices.shareOn'),
          cancelLabel: t('common.cancel'),
          onConfirm: () => apply({ sharing: true }),
        }),
    });
  };

  return (
    <div className="setting">
      <label className="check">
        <input
          type="checkbox"
          checked={status.sharing}
          onChange={(e) => (e.target.checked ? turnOn() : apply({ sharing: false }))}
        />
        {t('devices.share')}
      </label>
      <p className="hint">{t('devices.shareHint')}</p>
      {status.sharing && status.port !== null && (
        <p className="hint">
          {t('devices.listening', {
            list: status.addresses.map((a) => `${a}:${status.port}`).join(', ') || '—',
          })}
        </p>
      )}
      {status.error !== null && <p className="notice error">{status.error}</p>}
      <label>
        {t('devices.name')}
        <input
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name.trim() !== status.name && apply({ name: name.trim() })}
        />
      </label>
      {error !== null && <p className="notice error">{error}</p>}
    </div>
  );
}
