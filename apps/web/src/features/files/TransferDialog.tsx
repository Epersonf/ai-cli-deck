import { useRef } from 'react';
import { zipUrl } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { ModalTitle } from '../../shared/ui/ModalTitle';

interface Props {
  sessionId: string;
  dir: string;
  busy: boolean;
  onFiles(files: File[]): void;
  onClose(): void;
}

/** One place for moving files: upload into the current folder or download it as a .zip. */
export function TransferDialog({ sessionId, dir, busy, onFiles, onClose }: Props) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <ModalTitle title={t('files.transfer')} onClose={onClose} />
        <button type="button" disabled={busy} onClick={() => input.current?.click()}>
          ⬆ {t('files.upload')}
        </button>
        <a className="btn" href={zipUrl(sessionId, dir)} download onClick={onClose}>
          ⬇ {t('files.downloadZip')}
        </a>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            onFiles([...(e.target.files ?? [])]);
            e.target.value = '';
            onClose();
          }}
        />
      </div>
    </div>
  );
}
