import { PROFILE_BASES, type ProfileBase } from '@deck/shared';
import { useState, type FormEvent } from 'react';
import { api } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { ProfileList } from './ProfileList';
import { useProfiles } from './profilesStore';

interface Props {
  onClose(): void;
}

/** Makes a named, clean terminal. Nothing about logins or keys: that is set up inside it. */
export function ProfileDialog({ onClose }: Props) {
  const t = useT();
  const [label, setLabel] = useState('');
  const [base, setBase] = useState<ProfileBase>('claude');
  const [command, setCommand] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    setError(null);
    api
      .createProfile({ label: label.trim(), base, command: base === 'custom' ? command : '' })
      .then(() => (setLabel(''), setCommand(''), useProfiles.getState().refresh()))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'failed'));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('profile.title')}</h2>
        <p className="hint">{t('profile.intro')}</p>
        <ProfileList />
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
            <button type="submit" className="primary" disabled={label.trim() === ''}>
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
