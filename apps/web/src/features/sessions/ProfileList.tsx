import { useMemo, useState, type FormEvent } from 'react';
import { api } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { PencilIcon } from '../../shared/ui/Icons';
import { useProfiles } from './profilesStore';

/** The profiles you made, each renamable. The CLI behind a profile never changes. */
export function ProfileList() {
  const t = useT();
  const providers = useProfiles((s) => s.providers);
  const mine = useMemo(() => providers.filter((p) => p.profile), [providers]);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');

  const save = (event: FormEvent): void => {
    event.preventDefault();
    const id = editing;
    setEditing(null);
    if (id !== null && name.trim() !== '')
      void api
        .renameProfile(id, name.trim())
        .then(() => useProfiles.getState().refresh())
        .catch(() => undefined);
  };

  if (mine.length === 0) return null;
  return (
    <ul className="session-list profile-list" aria-label={t('profile.existing')}>
      {mine.map((p) => (
        <li key={p.id}>
          {editing === p.id ? (
            <form className="session-rename" onSubmit={save}>
              <input
                autoFocus
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
              />
              <button type="submit" className="primary">
                {t('switcher.save')}
              </button>
            </form>
          ) : (
            <>
              <span className="session-row static">
                <span className="session-main">
                  <strong>{p.label}</strong>
                  {p.status === 'missing' && <small>{p.hint}</small>}
                </span>
              </span>
              <button
                type="button"
                className="close"
                title={t('switcher.rename')}
                aria-label={t('switcher.rename')}
                onClick={() => (setName(p.label), setEditing(p.id))}
              >
                <PencilIcon />
              </button>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
