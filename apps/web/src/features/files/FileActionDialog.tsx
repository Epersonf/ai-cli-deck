import { downloadUrl } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { ModalTitle } from '../../shared/ui/ModalTitle';

interface Props {
  sessionId: string;
  path: string;
  onOpen(): void;
  onClose(): void;
}

/** Asked when a file is clicked: view it here, or save it to the device. */
export function FileActionDialog({ sessionId, path, onOpen, onClose }: Props) {
  const t = useT();
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
        <a className="btn" href={downloadUrl(sessionId, path)} download onClick={onClose}>
          ⬇ {t('files.download')}
        </a>
      </div>
    </div>
  );
}
