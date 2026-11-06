import { useEffect, useState } from 'react';
import { networkApi } from '../../shared/api/networkApi';
import { useT } from '../../shared/i18n/store';
import { ModalTitle } from '../../shared/ui/ModalTitle';
import { useNetwork } from './networkStore';
import { useSendProfile } from './sendProfileStore';

/** Sends a profile (sign-in, API key, settings) to a paired device, so it works there with no setup. */
export function SendProfileHost() {
  const t = useT();
  const { profile, close } = useSendProfile();
  const peers = useNetwork((s) => s.peers);
  const [to, setTo] = useState('');
  const [chats, setChats] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setTo('');
    setChats(false);
    setMessage(null);
  }, [profile]);
  if (!profile) return null;
  const target = to || peers[0]?.id || '';

  const send = (): void => {
    setBusy(true);
    networkApi
      .sendProfile(profile.id, target, chats)
      .then((sent) => setMessage({ text: t('devices.sent', { name: sent.on }), error: false }))
      .catch((e: unknown) =>
        setMessage({ text: e instanceof Error ? e.message : 'failed', error: true }),
      )
      .finally(() => setBusy(false));
  };
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <ModalTitle title={t('devices.sendTitle', { name: profile.label })} onClose={close} />
        <p className="hint">{t('devices.sendHint')}</p>
        {peers.length === 0 ? (
          <p>{t('devices.none')}</p>
        ) : (
          <>
            <select
              value={target}
              onChange={(e) => setTo(e.target.value)}
              aria-label={t('devices.paired')}
            >
              {peers.map((peer) => (
                <option key={peer.id} value={peer.id}>
                  {peer.name}
                </option>
              ))}
            </select>
            <label className="check">
              <input type="checkbox" checked={chats} onChange={(e) => setChats(e.target.checked)} />
              {t('devices.sendChats')}
            </label>
          </>
        )}
        {message && <p className={`notice${message.error ? ' error' : ''}`}>{message.text}</p>}
        <div className="row">
          {peers.length > 0 && (
            <button type="button" className="primary" disabled={busy || !target} onClick={send}>
              {t('devices.send')}
            </button>
          )}
          <button type="button" onClick={close}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
