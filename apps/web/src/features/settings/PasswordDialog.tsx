import { useT } from '../../shared/i18n/store';
import { ModalTitle } from '../../shared/ui/ModalTitle';
import { PasswordSection } from './PasswordSection';

/** Password change lives in its own dialog: it is long and rarely needed. */
export function PasswordDialog({ onClose }: { onClose(): void }) {
  const t = useT();
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <ModalTitle title={t('password.title')} onClose={onClose} />
        <PasswordSection />
        <button type="button" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}
