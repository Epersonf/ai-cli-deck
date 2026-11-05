import type { CreateSessionBody, ProviderInfo, Session } from '@deck/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { chatApi } from '../../shared/api/chatApi';
import { api } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { choices, pickDefault } from './profileChoices';
import { ProviderPicker } from './ProviderPicker';
import { loadRecent, rememberFolder } from './recentFolders';
import { SavedChats } from './SavedChats';
import { SessionOptions } from './SessionOptions';
import { useSessions } from './sessionsStore';
import { splitArgs } from './splitArgs';

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
  const [options, setOptions] = useState({ command: '', args: '', useWorktree: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .providers()
      .then((list) => {
        setProviders(list);
        setProvider((current) => current || pickDefault(choices(list, null)));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'failed'));
  }, []);

  /** Creates the terminal (a new chat, or a saved one continued) and shows it. */
  const start = async (create: () => Promise<Session>, remember: boolean): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const session = await create();
      if (remember) rememberFolder(session.cwd);
      useSessions.getState().upsert(session);
      useSessions.getState().select(session.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
      setBusy(false);
    }
  };

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const command = options.command.trim();
    const body: CreateSessionBody = {
      provider,
      cwd: cwd.trim(),
      useWorktree: options.useWorktree,
      command: command === '' ? null : command,
      args: splitArgs(options.args),
    };
    void start(() => api.createSession(body), true);
  };

  const install = (): void => {
    const setup = providers.find((p) => p.id === provider)?.setupId ?? provider;
    const body: CreateSessionBody = {
      provider: 'shell',
      cwd: cwd.trim() || defaultCwd || '~',
      useWorktree: false,
      command: 'clideck',
      args: ['setup', setup],
    };
    void start(() => api.createSession(body), false);
  };

  const missing = providers.find((p) => p.id === provider)?.status === 'missing';
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{t('newSession.title')}</h2>
        {providers.length > 0 && choices(providers, profileId).length === 0 && (
          <div className="notice">
            <p>{t('newSession.noProfiles')}</p>
            <button type="button" className="primary" onClick={() => (onClose(), onProfile())}>
              {t('switcher.newProfile')}
            </button>
          </div>
        )}
        <ProviderPicker
          providers={choices(providers, profileId)}
          value={provider}
          onChange={setProvider}
          onInstall={install}
          disabled={busy}
        />
        <label>
          {t('newSession.folder')}
          <input
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            list="recent-folders"
            placeholder={defaultCwd ?? '~'}
            required
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <datalist id="recent-folders">
            {loadRecent().map((folder) => (
              <option key={folder} value={folder} />
            ))}
          </datalist>
        </label>
        <SavedChats
          provider={provider}
          cwd={cwd}
          disabled={busy}
          onOpen={(chatId) =>
            void start(() => chatApi.open({ provider, cwd: cwd.trim(), chatId }), true)
          }
        />
        <SessionOptions provider={provider} values={options} onChange={setOptions} />
        {error !== null && <p className="notice error">{error}</p>}
        <div className="row">
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
    </div>
  );
}
