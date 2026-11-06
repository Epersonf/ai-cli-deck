import { PAIR_CODE_LENGTH, type PairStart } from '@deck/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { networkApi } from '../../shared/api/networkApi';
import { useT } from '../../shared/i18n/store';
import { ModalTitle } from '../../shared/ui/ModalTitle';

interface Props {
  address: string;
  onPaired(): void;
  onClose(): void;
}

/** Asks the deck at `address` to pair, then sends the code the user reads on its screen. */
export function PairDialog({ address, onPaired, onClose }: Props) {
  const t = useT();
  const [started, setStarted] = useState<PairStart | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pairing = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    networkApi
      .pair(address)
      .then((next) => {
        pairing.current = next.pairingId;
        if (live) setStarted(next);
        else void networkApi.cancel(next.pairingId).catch(() => undefined);
      })
      .catch((e: unknown) => live && setMessage(e instanceof Error ? e.message : 'failed'));
    return () => {
      live = false;
      if (pairing.current) void networkApi.cancel(pairing.current).catch(() => undefined);
    };
  }, [address]);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (!started || code.length !== PAIR_CODE_LENGTH) return;
    setBusy(true);
    networkApi
      .submit(started.pairingId, code)
      .then((result) => {
        if (result.peer) {
          pairing.current = null;
          return onPaired();
        }
        setCode('');
        setMessage(t('devices.wrongCode', { left: String(result.left ?? 0) }));
      })
      .catch((e: unknown) => {
        pairing.current = null;
        setStarted(null);
        setMessage(e instanceof Error ? e.message : 'failed');
      })
      .finally(() => setBusy(false));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal pair-dialog" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <ModalTitle title={t('devices.pairTitle')} onClose={onClose} />
        {!started && message === null && <p>{t('devices.connecting', { name: address })}</p>}
        {started && (
          <label>
            {t('devices.typeCode', { name: started.name })}
            <input
              className="pair-code"
              value={code}
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={PAIR_CODE_LENGTH}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </label>
        )}
        {message !== null && <p className="notice error">{message}</p>}
        <div className="row">
          {started && (
            <button
              type="submit"
              className="primary"
              disabled={busy || code.length !== PAIR_CODE_LENGTH}
            >
              {t('devices.pair')}
            </button>
          )}
          <button type="button" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
