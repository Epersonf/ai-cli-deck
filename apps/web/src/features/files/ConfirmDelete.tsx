import { useState } from 'react';
import { api } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { ModalTitle } from '../../shared/ui/ModalTitle';

interface Props {
  sessionId: string;
  path: string;
  kind: 'file' | 'dir';
  onDeleted(): void;
  onClose(): void;
}

/** Asks before deleting a file or a whole folder; nothing is removed until confirmed. */
export function ConfirmDelete({ sessionId, path, kind, onDeleted, onClose }: Props) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = path.split('/').pop() ?? path;

  const confirm = (): void => {
    setBusy(true);
    api
      .deleteEntry(sessionId, path)
      .then(() => (onDeleted(), onClose()))
      .catch((e: unknown) => (setError(e instanceof Error ? e.message : 'failed'), setBusy(false)));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <ModalTitle title={t('files.delete')} onClose={onClose} />
        <p className="hint confirm-text">
          {t(kind === 'dir' ? 'files.deleteFolder' : 'files.deleteFile', { name })}
        </p>
        {error !== null && <p className="notice error">{error}</p>}
        <button type="button" className="danger" disabled={busy} onClick={confirm}>
          🗑 {t('files.delete')}
        </button>
        <button type="button" disabled={busy} onClick={onClose}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
