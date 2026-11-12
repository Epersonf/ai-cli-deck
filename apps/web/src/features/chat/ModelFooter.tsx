import type { ChatConfig } from '@deck/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { modelApi } from '../../shared/api/modelApi';
import { useT } from '../../shared/i18n/store';
import { PinIcon } from '../../shared/ui/GlyphIcons';

interface Props {
  config: ChatConfig;
  provider: string;
  profile: string;
  onUse(model: string): void;
}

/** Under the model list: any other model id, and the profile's default. */
export function ModelFooter({ config, provider, profile, onUse }: Props) {
  const t = useT();
  const [typed, setTyped] = useState('');
  const [saved, setSaved] = useState(config.defaultModel);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setSaved(config.defaultModel), [config.defaultModel]);
  const chosen = config.model;

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (typed.trim() !== '') onUse(typed.trim());
  };
  const makeDefault = (): void => {
    setError(null);
    modelApi
      .setDefault(provider, chosen)
      .then(() => setSaved(chosen))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'failed'));
  };
  return (
    <div className="drop-footer">
      <form className="drop-other" onSubmit={submit}>
        <input
          value={typed}
          placeholder={t('chat.model.other')}
          aria-label={t('chat.model.other')}
          spellCheck={false}
          autoCapitalize="off"
          onChange={(e) => setTyped(e.target.value)}
        />
        <button type="submit" className="ghost" disabled={typed.trim() === ''}>
          {t('chat.model.use')}
        </button>
      </form>
      <button
        type="button"
        className="drop-action"
        disabled={chosen === saved}
        onClick={makeDefault}
      >
        <PinIcon size={16} />
        {chosen === null
          ? t('chat.model.useAgentDefault')
          : t('chat.model.setDefault', { profile })}
      </button>
      {error !== null && <p className="notice error">{error}</p>}
    </div>
  );
}
