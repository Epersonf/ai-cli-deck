import { useEffect } from 'react';
import { useT } from '../i18n/store';

interface Props {
  title: string;
  onClose(): void;
}

/** Dialog heading with an X button; Escape closes too. Clicking outside is handled by the backdrop. */
export function ModalTitle({ title, onClose }: Props) {
  const t = useT();
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-title">
      <h2>{title}</h2>
      <button type="button" className="modal-x" aria-label={t('common.close')} onClick={onClose}>
        ×
      </button>
    </div>
  );
}
