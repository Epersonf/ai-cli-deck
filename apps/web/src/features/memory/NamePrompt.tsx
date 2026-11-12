import { MEMORY_LIMITS } from '@deck/shared';
import { useState, type FormEvent } from 'react';
import { useT } from '../../shared/i18n/store';

interface Props {
  title: string;
  initial: string;
  onSubmit(name: string): void;
  onClose(): void;
}

/** A small box asking for a folder's name. */
export function NamePrompt({ title, initial, onSubmit, onClose }: Props) {
  const t = useT();
  const [name, setName] = useState(initial);
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (name.trim() !== '') onSubmit(name.trim());
  };
  return (
    <div className="modal-backdrop confirm-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{title}</h2>
        <input
          value={name}
          maxLength={MEMORY_LIMITS.folderName}
          aria-label={t('memory.folderName')}
          placeholder={t('memory.folderName')}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
        <div className="dialog-actions">
          <button type="submit" className="primary" disabled={name.trim() === ''}>
            {t('memory.save')}
          </button>
          <button type="button" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
