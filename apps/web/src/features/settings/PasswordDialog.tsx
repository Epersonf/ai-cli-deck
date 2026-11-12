import { useT } from '../../shared/i18n/store';
import { ModalTitle } from '../../shared/ui/ModalTitle';
import { AccessSection } from '../access/AccessSection';

/** How the deck is unlocked lives in its own dialog: it is long and rarely needed. */
export function PasswordDialog({ onClose }: { onClose(): void }) {
  const t = useT();
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <ModalTitle title={t('password.title')} onClose={onClose} />
        <AccessSection />
        <button type="button" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}
