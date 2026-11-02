import { PROFILE_BASES, type ProfileBase } from '@deck/shared';
import { useState, type FormEvent } from 'react';
import { api } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { useProfiles } from './profilesStore';

interface Props {
  /** Called after a profile is created, so the caller can show it. */
  onDone(): void;
  onClose(): void;
}

/** Makes a named, clean terminal. Nothing about logins or keys: that is set up inside it. */
export function ProfileDialog({ onDone, onClose }: Props) {
  const t = useT();
  const [label, setLabel] = useState('');
  const [base, setBase] = useState<ProfileBase>('claude');
  const [command, setCommand] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    api
      .createProfile({ label: label.trim(), base, command: base === 'custom' ? command : '' })
      .then(() => useProfiles.getState().refresh())
      .then(onDone)
      .catch((e: unknown) => (setError(e instanceof Error ? e.message : 'failed'), setBusy(false)));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('profile.title')}</h2>
        <p className="hint">{t('profile.intro')}</p>
        <form className="profile-form" onSubmit={submit}>
          <label>
            {t('profile.label')}
            <input
              required
              value={label}
              maxLength={60}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label>
            {t('profile.base')}
            <select
              value={base}
              onChange={(e) => setBase(PROFILE_BASES.find((b) => b === e.target.value) ?? 'claude')}
            >
              {PROFILE_BASES.map((b) => (
                <option key={b} value={b}>
                  {t(`profile.base.${b}`)}
                </option>
              ))}
            </select>
          </label>
          {base === 'custom' && (
            <label>
              {t('profile.command')}
              <input
                value={command}
                spellCheck={false}
                onChange={(e) => setCommand(e.target.value)}
              />
            </label>
          )}
          {error !== null && <p className="notice error">{error}</p>}
          <div className="row">
            <button type="submit" className="primary" disabled={busy || label.trim() === ''}>
              {t('profile.create')}
            </button>
            <button type="button" onClick={onClose}>
              {t('common.close')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
