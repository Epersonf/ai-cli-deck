import { useEffect, useState } from 'react';
import { api } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { ModalTitle } from '../../shared/ui/ModalTitle';
import { useConfirm } from '../confirm/confirmStore';
import { useProfiles } from '../sessions/profilesStore';
import { templateName } from '../sessions/templateName';
import { checkTemplateText, copyText, downloadText } from './templateFile';

const message = (e: unknown): string => (e instanceof Error ? e.message : 'failed');

/** Where profile templates are listed, imported from a file (or pasted) and removed, plus the commented example. */
export function TemplatesDialog({ onClose }: { onClose(): void }) {
  const t = useT();
  const templates = useProfiles((s) => s.templates);
  const ask = useConfirm((s) => s.ask);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const reload = (): Promise<void> => useProfiles.getState().refreshTemplates();
  useEffect(() => void reload().catch(() => undefined), []);

  const fail = (e: unknown): void => (setNote(null), setError(message(e)));
  const chooseFile = (file: File | undefined): void => {
    if (file) void file.text().then(setText, fail);
  };

  const importText = (): void => {
    setError(null);
    setNote(null);
    const checked = checkTemplateText(text);
    if (typeof checked === 'string') return setError(checked);
    ask({
      title: t('templates.confirmTitle'),
      message: t('templates.confirmBody', {
        name: checked.label,
        command: checked.command || '(shell)',
      }),
      confirmLabel: t('templates.import'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => {
        api
          .importTemplate(text)
          .then(reload)
          .then(() => (setText(''), setNote(t('templates.imported', { name: checked.label }))))
          .catch(fail);
      },
    });
  };

  const example = (action: (text: string) => Promise<void> | void): void => {
    setError(null);
    api.templateSkeleton().then(action).catch(fail);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal templates" onClick={(event) => event.stopPropagation()}>
        <ModalTitle title={t('templates.title')} onClose={onClose} />
        <p className="hint">{t('templates.intro')}</p>
        <ul className="template-list">
          {templates.map((x) => (
            <li key={x.id}>
              <span>
                <strong>{templateName(t, x)}</strong> <small>{x.id}</small>
                {x.description !== '' && <small className="hint"> {x.description}</small>}
              </span>
              {x.builtin ? (
                <small>{t('templates.builtin')}</small>
              ) : (
                <button
                  type="button"
                  onClick={() => void api.removeTemplate(x.id).then(reload).catch(fail)}
                >
                  {t('templates.remove')}
                </button>
              )}
            </li>
          ))}
        </ul>
        <label>
          {t('templates.paste')}
          <textarea
            value={text}
            rows={5}
            spellCheck={false}
            placeholder='{ "schema": 1, "id": "my-ai-cli", ... }'
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <p className="hint warn-text">{t('templates.warning')}</p>
        {error !== null && <p className="notice error">{error}</p>}
        {note !== null && <p className="notice">{note}</p>}
        <div className="row">
          <label className="file-button">
            {t('templates.chooseFile')}
            <input
              type="file"
              accept=".json,.jsonc,application/json"
              hidden
              onChange={(e) => chooseFile(e.target.files?.[0])}
            />
          </label>
          <button
            type="button"
            className="primary"
            disabled={text.trim() === ''}
            onClick={importText}
          >
            {t('templates.import')}
          </button>
        </div>
        <div className="row">
          <button
            type="button"
            onClick={() => example((s) => downloadText('profile-template.jsonc', s))}
          >
            {t('templates.download')}
          </button>
          <button
            type="button"
            onClick={() => example((s) => copyText(s).then(() => setNote(t('templates.copied'))))}
          >
            {t('templates.copy')}
          </button>
        </div>
      </div>
    </div>
  );
}
