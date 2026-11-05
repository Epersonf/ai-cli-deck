import type { QuickPrompt } from '@deck/shared';
import { useEffect, useState } from 'react';
import { useT } from '../../shared/i18n/store';
import { ModalTitle } from '../../shared/ui/ModalTitle';
import { usePrompts } from './promptsStore';

const EMPTY: QuickPrompt = { label: '', text: '', enter: true };
const complete = (p: QuickPrompt): boolean => p.label.trim() !== '' && p.text !== '';

/** Edits the quick prompts: a short label for the button, the text it types, and whether Enter follows. */
export function PromptsDialog({ onClose }: { onClose(): void }) {
  const t = useT();
  const saved = usePrompts((s) => s.prompts);
  const [draft, setDraft] = useState<QuickPrompt[]>([...saved]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    usePrompts
      .getState()
      .load()
      .then(() => setDraft([...usePrompts.getState().prompts]))
      .catch(() => undefined);
  }, []);

  const edit = (index: number, change: Partial<QuickPrompt>): void =>
    setDraft((list) => list.map((p, i) => (i === index ? { ...p, ...change } : p)));
  const move = (index: number, delta: -1 | 1): void =>
    setDraft((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      if (item) next.splice(Math.max(0, Math.min(next.length, index + delta)), 0, item);
      return next;
    });
  const save = (): void => {
    setError(null);
    usePrompts
      .getState()
      .save(draft.filter(complete))
      .then(onClose)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'failed'));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal prompts-dialog" onClick={(event) => event.stopPropagation()}>
        <ModalTitle title={t('prompts.title')} onClose={onClose} />
        <p className="hint">{t('prompts.hint')}</p>
        {draft.map((prompt, i) => (
          <div key={i} className="prompt-edit">
            <div className="prompt-edit-row">
              <input
                value={prompt.label}
                maxLength={32}
                placeholder={t('prompts.label')}
                aria-label={t('prompts.label')}
                onChange={(e) => edit(i, { label: e.target.value })}
              />
              <button
                type="button"
                className="tool"
                title={t('prompts.up')}
                onClick={() => move(i, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="tool"
                title={t('prompts.down')}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="tool"
                title={t('prompts.remove')}
                onClick={() => setDraft((list) => list.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
            <textarea
              value={prompt.text}
              rows={2}
              placeholder={t('prompts.text')}
              aria-label={t('prompts.text')}
              onChange={(e) => edit(i, { text: e.target.value })}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={prompt.enter}
                onChange={(e) => edit(i, { enter: e.target.checked })}
              />
              {t('prompts.enter')}
            </label>
          </div>
        ))}
        <button type="button" onClick={() => setDraft((list) => [...list, { ...EMPTY }])}>
          {t('prompts.add')}
        </button>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="button" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="primary" onClick={save}>
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
