import type { CreateSessionBody, ProviderInfo } from '@deck/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { ProviderPicker } from './ProviderPicker';
import { loadRecent, rememberFolder } from './recentFolders';
import { SessionOptions } from './SessionOptions';
import { useSessions } from './sessionsStore';
import { splitArgs } from './splitArgs';

interface Props {
  defaultCwd: string | null;
  /** When set, the session is created inside this profile and the CLI picker is hidden. */
  profileId: string | null;
  onClose(): void;
}

const PREFERRED = ['claude', 'codex', 'shell'];

const pickDefault = (list: readonly ProviderInfo[]): string =>
  PREFERRED.map((id) => list.find((p) => p.id === id && p.status !== 'missing')).find(Boolean)
    ?.id ??
  list[0]?.id ??
  '';

export function NewSessionDialog({ defaultCwd, profileId, onClose }: Props) {
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
        setProvider((current) => current || pickDefault(list));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'failed'));
  }, []);

  const launch = async (body: CreateSessionBody, remember: boolean): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const session = await api.createSession(body);
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
    void launch(
      {
        provider,
        cwd: cwd.trim(),
        useWorktree: options.useWorktree,
        command: command === '' ? null : command,
        args: splitArgs(options.args),
      },
      true,
    );
  };

  const install = (): void =>
    void launch(
      {
        provider: 'shell',
        cwd: cwd.trim() || defaultCwd || '~',
        useWorktree: false,
        command: 'clideck',
        args: ['setup', providers.find((p) => p.id === provider)?.setupId ?? provider],
      },
      false,
    );

  const missing = providers.find((p) => p.id === provider)?.status === 'missing';
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{t('newSession.title')}</h2>
        <ProviderPicker
          providers={profileId === null ? providers : providers.filter((p) => p.id === profileId)}
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
        <SessionOptions provider={provider} values={options} onChange={setOptions} />
        {error !== null && <p className="notice error">{error}</p>}
        <div className="row">
          <button type="submit" className="primary" disabled={busy || provider === '' || missing}>
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
