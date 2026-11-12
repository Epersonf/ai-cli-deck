import { useState, type FormEvent } from 'react';
import { api } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { Disclosure, FieldRow, InlineField } from '../../shared/ui/DialogParts';
import { EyeIcon, EyeOffIcon } from '../../shared/ui/ShapeIcons';
import type { MethodInfo } from './methods';

interface Props {
  provider: string;
  method: MethodInfo;
  onSaved(): void;
}

/** One labeled password field with a show/hide eye; where to get the key is a collapsed disclosure. */
export function KeyForm({ provider, method, onSaved }: Props) {
  const t = useT();
  const [secret, setSecret] = useState('');
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = (event: FormEvent): void => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    api
      .setProfileSecret(provider, secret.trim())
      .then(onSaved)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'failed'))
      .finally(() => setBusy(false));
  };
  return (
    <form className="signin-key" onSubmit={save}>
      <FieldRow label={t('signin.keyField')}>
        <InlineField>
          <input
            type={shown ? 'text' : 'password'}
            value={secret}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="off"
            onChange={(e) => setSecret(e.target.value)}
          />
          <button
            type="button"
            className="icon-btn"
            aria-label={shown ? t('signin.hideKey') : t('signin.showKey')}
            title={shown ? t('signin.hideKey') : t('signin.showKey')}
            onClick={() => setShown(!shown)}
          >
            {shown ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
          </button>
        </InlineField>
      </FieldRow>
      {method.help !== undefined && (
        <Disclosure summary={t('signin.where')}>
          <p className="hint">{t(method.help)}</p>
          {method.link && (
            <a className="signin-link" href={method.link.href} target="_blank" rel="noreferrer">
              {method.link.label}
            </a>
          )}
        </Disclosure>
      )}
      {error !== null && <p className="notice error">{error}</p>}
      <button type="submit" className="primary" disabled={busy || secret.trim() === ''}>
        {t('chat.key.save')}
      </button>
    </form>
  );
}
