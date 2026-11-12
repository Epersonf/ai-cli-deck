import { MEMORY_LIMITS, type MemoryEntry } from '@deck/shared';
import { useState, type FormEvent } from 'react';
import { useT } from '../../shared/i18n/store';

interface Props {
  /** The note being edited; null for a new one. */
  note: MemoryEntry | null;
  onSave(draft: { title: string; body: string; enabled: boolean }): Promise<boolean>;
  onClose(): void;
}

/** Title, markdown body with a counter, and whether agents see the note. */
export function NoteEditor({ note, onSave, onClose }: Props) {
  const t = useT();
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [enabled, setEnabled] = useState(note?.enabled ?? true);
  const [busy, setBusy] = useState(false);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    setBusy(true);
    void onSave({ title: title.trim(), body, enabled }).then((ok) =>
      ok ? onClose() : setBusy(false),
    );
  };
  return (
    <form className="memory-editor" onSubmit={submit}>
      <h2>{note ? t('memory.editNote') : t('memory.newNote')}</h2>
      <label>
        {t('memory.noteTitle')}
        <input
          value={title}
          maxLength={MEMORY_LIMITS.title}
          required
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        {t('memory.noteBody')}
        <textarea
          value={body}
          rows={10}
          maxLength={MEMORY_LIMITS.body}
          spellCheck={false}
          onChange={(e) => setBody(e.target.value)}
        />
        <span className="hint memory-count">
          {t('memory.counter', { count: body.length, max: MEMORY_LIMITS.body })}
        </span>
      </label>
      <label className="check">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        {t('memory.enabled')}
      </label>
      <div className="dialog-actions">
        <button type="submit" className="primary" disabled={busy || title.trim() === ''}>
          {t('memory.save')}
        </button>
        <button type="button" onClick={onClose}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}
