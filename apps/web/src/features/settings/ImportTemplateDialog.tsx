import { useState } from 'react';
import { api } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { ModalTitle } from '../../shared/ui/ModalTitle';
import { useConfirm } from '../confirm/confirmStore';
import { useProfiles } from '../sessions/profilesStore';
import { checkTemplateText } from './templateFile';

interface Props {
  onClose(): void;
  onImported(name: string): void;
}

/** Paste a template or choose a file, check it, show what it will run, and import it after a confirmation. */
export function ImportTemplateDialog({ onClose, onImported }: Props) {
  const t = useT();
  const ask = useConfirm((s) => s.ask);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fail = (e: unknown): void => setError(e instanceof Error ? e.message : 'failed');
  const submit = (): void => {
    setError(null);
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
          .then(() => useProfiles.getState().refreshTemplates())
          .then(() => onImported(checked.label))
          .catch(fail);
      },
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal templates" onClick={(event) => event.stopPropagation()}>
        <ModalTitle title={t('templates.importTitle')} onClose={onClose} />
        <label>
          {t('templates.paste')}
          <textarea
            value={text}
            rows={9}
            spellCheck={false}
            autoCapitalize="off"
            placeholder='{ "schema": 1, "id": "my-ai-cli", ... }'
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <p className="hint warn-text">{t('templates.warning')}</p>
        {error !== null && <p className="notice error">{error}</p>}
        <div className="button-pair">
          <label className="btn file-button">
            {t('templates.chooseFile')}
            <input
              type="file"
              accept=".json,.jsonc,application/json"
              hidden
              onChange={(e) => void e.target.files?.[0]?.text().then(setText, fail)}
            />
          </label>
          <button type="button" className="primary" disabled={text.trim() === ''} onClick={submit}>
            {t('templates.import')}
          </button>
        </div>
      </div>
    </div>
  );
}
