import { useState, type FormEvent } from 'react';
import { api } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';

interface Props {
  onClose(): void;
}

const slug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Creates another account/key profile for an official CLI; the deck never sees the key. */
export function ProfileDialog({ onClose }: Props) {
  const t = useT();
  const [base, setBase] = useState<'claude' | 'codex'>('claude');
  const [label, setLabel] = useState('');
  const [keyEnv, setKeyEnv] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    setError(null);
    api
      .createProfile({
        id: slug(label),
        base,
        label: label.trim(),
        keyEnv: keyEnv.trim() === '' ? null : keyEnv.trim(),
      })
      .then(() => setDone(true))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'failed'));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{t('profile.title')}</h2>
        <p className="hint">{t('profile.intro')}</p>
        <label>
          {t('profile.cli')}
          <select
            value={base}
            onChange={(e) => setBase(e.target.value === 'codex' ? 'codex' : 'claude')}
          >
            <option value="claude">Claude Code</option>
            <option value="codex">Codex</option>
          </select>
        </label>
        <label>
          {t('profile.label')}
          <input required value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label>
          {t('profile.keyEnv')}
          <input
            value={keyEnv}
            spellCheck={false}
            autoCapitalize="off"
            placeholder="WORK_ANTHROPIC_KEY"
            onChange={(e) => setKeyEnv(e.target.value)}
          />
        </label>
        <p className="hint">{t('profile.keyHelp')}</p>
        {error !== null && <p className="notice error">{error}</p>}
        {done && <p className="notice">{t('profile.created')}</p>}
        <div className="row">
          {!done && (
            <button type="submit" className="primary" disabled={slug(label) === ''}>
              {t('profile.create')}
            </button>
          )}
          <button type="button" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </form>
    </div>
  );
}
