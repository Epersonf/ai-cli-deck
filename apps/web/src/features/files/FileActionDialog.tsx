import { useState } from 'react';
import { downloadUrl } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { ModalTitle } from '../../shared/ui/ModalTitle';
import { ConfirmDelete } from './ConfirmDelete';
import { DownloadIcon } from '../../shared/ui/GlyphIcons';
import { TrashIcon } from '../../shared/ui/Icons';
import { mentionInChat } from './mention';

interface Props {
  sessionId: string;
  path: string;
  onOpen(): void;
  onDeleted(): void;
  onClose(): void;
}

/** Asked when a file is clicked: view it here, or save it to the device. */
export function FileActionDialog({ sessionId, path, onOpen, onDeleted, onClose }: Props) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  if (confirming)
    return (
      <ConfirmDelete
        sessionId={sessionId}
        path={path}
        kind="file"
        onDeleted={onDeleted}
        onClose={onClose}
      />
    );
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <ModalTitle title={path.split('/').pop() ?? path} onClose={onClose} />
        <p className="hint">{t('files.fileTitle')}</p>
        <button
          type="button"
          onClick={() => {
            onOpen();
            onClose();
          }}
        >
          {t('common.open')}
        </button>
        <button
          type="button"
          onClick={() => {
            mentionInChat(sessionId, path, t('files.mentioned'));
            onClose();
          }}
        >
          {t('files.mention')}
        </button>
        <a className="btn" href={downloadUrl(sessionId, path)} download onClick={onClose}>
          <DownloadIcon size={16} /> {t('files.download')}
        </a>
        <button type="button" className="danger" onClick={() => setConfirming(true)}>
          <TrashIcon size={16} /> {t('files.delete')}
        </button>
      </div>
    </div>
  );
}
