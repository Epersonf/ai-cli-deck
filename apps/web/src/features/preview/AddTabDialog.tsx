import { PEER_ID } from '../../shared/api/base';
import { useT } from '../../shared/i18n/store';
import { ModalTitle } from '../../shared/ui/ModalTitle';
import type { PreviewMode } from './previewTabs';

interface Props {
  onPick(mode: PreviewMode): void;
  onClose(): void;
}

/** What a new preview tab is: an iframe on this device, or a page of the deck's own browser. */
export function AddTabDialog({ onPick, onClose }: Props) {
  const t = useT();
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal add-tab" role="dialog" onClick={(e) => e.stopPropagation()}>
        <ModalTitle title={t('preview.addTab')} onClose={onClose} />
        <button
          type="button"
          className="add-tab-option"
          disabled={PEER_ID !== null}
          onClick={() => onPick('frame')}
        >
          <strong>{t('preview.modeFrame')}</strong>
          <small>{t(PEER_ID ? 'preview.frameNoPair' : 'preview.frameDesc')}</small>
        </button>
        <button type="button" className="add-tab-option" onClick={() => onPick('browser')}>
          <strong>{t('preview.modeBrowser')}</strong>
          <small>{t('preview.browserDesc')}</small>
        </button>
      </div>
    </div>
  );
}
