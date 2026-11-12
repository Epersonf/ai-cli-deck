import type { ChatConfig } from '@deck/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { modelApi } from '../../shared/api/modelApi';
import { useT } from '../../shared/i18n/store';

interface Props {
  config: ChatConfig;
  provider: string;
  profileLabel: string;
  labelOf(id: string): string;
  onChoose(model: string | null): void;
  onClose(): void;
}

/** Models offered by the agent (never listed in the code), a free text for other ids, and the profile's default. */
export function ModelSheet({ config, provider, profileLabel, labelOf, onChoose, onClose }: Props) {
  const t = useT();
  const [typed, setTyped] = useState('');
  const [saved, setSaved] = useState(config.defaultModel);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setSaved(config.defaultModel), [config.defaultModel]);
  const chosen = config.model;

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (typed.trim() !== '') onChoose(typed.trim());
  };
  const makeDefault = (): void => {
    setError(null);
    modelApi
      .setDefault(provider, chosen)
      .then(() => setSaved(chosen))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'failed'));
  };
  const row = (id: string | null, label: string, hint: string | null) => (
    <li key={id ?? 'agent-default'}>
      <button
        type="button"
        role="radio"
        aria-checked={id === chosen}
        className={id === chosen ? 'primary' : ''}
        onClick={() => onChoose(id)}
      >
        <span>{label}</span>
        {id === saved && <small className="model-tag">{t('chat.model.isDefault')}</small>}
        {hint !== null && hint !== '' && <small className="hint">{hint}</small>}
      </button>
    </li>
  );

  return (
    <div className="modal-backdrop sheet" onClick={onClose}>
      <div className="modal model-sheet" role="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{t('chat.model')}</h2>
        <ul className="model-list" role="radiogroup">
          {row(null, t('chat.modelDefault'), null)}
          {config.modelChoices.map((c) => row(c.id, c.label, c.description))}
        </ul>
        <form className="field-inline" onSubmit={submit}>
          <input
            value={typed}
            placeholder={t('chat.model.other')}
            aria-label={t('chat.model.other')}
            spellCheck={false}
            autoCapitalize="off"
            onChange={(e) => setTyped(e.target.value)}
          />
          <button type="submit" disabled={typed.trim() === ''}>
            {t('chat.model.use')}
          </button>
        </form>
        <p className="hint">
          {t('chat.model.default', {
            model: saved === null ? t('chat.model.agentOwn') : labelOf(saved),
          })}
        </p>
        <button type="button" disabled={chosen === saved} onClick={makeDefault}>
          {chosen === null
            ? t('chat.model.useAgentDefault')
            : t('chat.model.setDefault', { profile: profileLabel })}
        </button>
        {error !== null && <p className="notice error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
