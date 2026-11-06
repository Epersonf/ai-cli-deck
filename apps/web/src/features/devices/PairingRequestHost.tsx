import type { PairingRequest } from '@deck/shared';
import { useState } from 'react';
import { PEER_ID } from '../../shared/api/base';
import { networkApi } from '../../shared/api/networkApi';
import { useT } from '../../shared/i18n/store';
import { usePolling } from '../../shared/ui/usePolling';
import { useNetwork } from './networkStore';

const POLL_MS = 2000;

/** While this deck shares itself, a deck asking to pair shows its code here, on any screen. */
export function PairingRequestHost() {
  const t = useT();
  const sharing = useNetwork((s) => s.status?.sharing ?? false);
  const [requests, setRequests] = useState<PairingRequest[]>([]);
  usePolling(
    () =>
      sharing && !PEER_ID
        ? networkApi.requests().then(setRequests)
        : Promise.resolve(setRequests([])),
    POLL_MS,
  );
  const request = requests[0];
  if (!request) return null;

  const refuse = (): void => {
    setRequests((list) => list.slice(1));
    void networkApi.refuse(request.id).catch(() => undefined);
  };
  return (
    <div className="modal-backdrop confirm-backdrop">
      <div className="modal pair-request" role="alertdialog">
        <h2>{t('devices.requestTitle')}</h2>
        <p>{t('devices.requestBody', { name: request.name })}</p>
        <p className="pair-shown-code" aria-label={request.code}>
          {request.code.slice(0, 3)} {request.code.slice(3)}
        </p>
        <p className="hint">{t('devices.requestHint')}</p>
        <div className="row">
          <button type="button" className="danger" onClick={refuse}>
            {t('devices.refuse')}
          </button>
        </div>
      </div>
    </div>
  );
}
