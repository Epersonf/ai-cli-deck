import type { ProviderInfo } from '@deck/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { FolderPicker } from '../folders/FolderPicker';
import { api } from '../../shared/api/endpoints';
import { signinApi } from '../../shared/api/signinApi';
import { useT } from '../../shared/i18n/store';
import { choices, pickDefault } from './profileChoices';
import { ProviderPicker } from './ProviderPicker';
import { forgetFolder, loadRecent, rememberFolder } from './recentFolders';
import { useSessions } from './sessionsStore';

interface Props {
  defaultCwd: string | null;
  /** When set, the session is created inside this profile and the CLI picker is hidden. */
  profileId: string | null;
  onProfile(): void;
  onClose(): void;
}

export function NewSessionDialog({ defaultCwd, profileId, onProfile, onClose }: Props) {
  const t = useT();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProvider] = useState(profileId ?? '');
  const [cwd, setCwd] = useState(() => loadRecent()[0] ?? defaultCwd ?? '');
  const [useWorktree, setUseWorktree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);

  // A remembered folder that does not exist on this machine is dropped for the default (the home folder).
  useEffect(() => {
    const first = cwd;
    if (first === '' || first === defaultCwd) return;
    signinApi.dirs(first).catch(() => {
      forgetFolder(first);
      setCwd((now) => (now === first ? (defaultCwd ?? '') : now));
    });
    // only the folder the dialog opened with
  }, []);

  useEffect(() => {
    api
      .providers()
      .then((list) => {
        setProviders(list);
        setProvider((current) => current || pickDefault(choices(list, null)));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'failed'));
  }, []);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await api.createSession({
        provider,
        cwd: cwd.trim(),
        useWorktree,
        chatId: null,
      });
      rememberFolder(session.cwd);
      useSessions.getState().upsert(session);
      useSessions.getState().select(session.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
      setBusy(false);
    }
  };

  const missing = providers.find((p) => p.id === provider)?.status === 'missing';
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => void submit(e)}>
        <h2>{t('newSession.title')}</h2>
        {profileId === null && (
          <button type="button" className="link-button" onClick={() => (onClose(), onProfile())}>
            {t('switcher.newProfile')}
          </button>
        )}
        <ProviderPicker
          providers={choices(providers, profileId)}
          value={provider}
          onChange={setProvider}
        />
        <div className="field-row">
          {t('newSession.folder')}
          <div className="field-inline">
            <input
              value={cwd}
              readOnly
              required
              placeholder={defaultCwd ?? '~'}
              aria-label={t('newSession.folder')}
              onClick={() => setPicking(true)}
            />
            <button type="button" onClick={() => setPicking(true)}>
              {t('folder.browse')}
            </button>
          </div>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={useWorktree}
            onChange={(e) => setUseWorktree(e.target.checked)}
          />
          {t('newSession.worktree')}
        </label>
        {error !== null && <p className="notice error">{error}</p>}
        <div className="dialog-actions">
          <button
            type="submit"
            className="primary"
            disabled={
              busy || provider === '' || missing || choices(providers, profileId).length === 0
            }
          >
            {t('newSession.start')}
          </button>
          <button type="button" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
      </form>
      {picking && (
        <FolderPicker
          start={cwd}
          onPick={(path) => (setCwd(path), setPicking(false))}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
