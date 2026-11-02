import type { ProviderInfo } from '@deck/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../shared/api/endpoints';
import { loadRecent, rememberFolder } from './recentFolders';
import { useSessions } from './sessionsStore';
import { splitArgs } from './splitArgs';

interface Props {
  defaultCwd: string | null;
  onClose(): void;
}

const NEEDS_COMMAND = new Set(['custom']);

export function NewSessionDialog({ defaultCwd, onClose }: Props) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProvider] = useState('');
  const [cwd, setCwd] = useState(() => loadRecent()[0] ?? defaultCwd ?? '');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [useWorktree, setUseWorktree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .providers()
      .then((list) => {
        setProviders(list);
        setProvider(
          (current) => current || (list.find((p) => p.id === 'claude') ?? list[0])?.id || '',
        );
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
        command: command.trim() === '' ? null : command.trim(),
        args: splitArgs(args),
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={(e) => void submit(e)}>
        <h2>New session</h2>
        <label>
          CLI
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Folder
          <input
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            list="recent-folders"
            placeholder="/root/workspace/project"
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
        {(NEEDS_COMMAND.has(provider) || provider === 'shell') && (
          <label>
            Command {provider === 'shell' ? '(optional, default bash)' : ''}
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="aider"
              required={NEEDS_COMMAND.has(provider)}
              autoCapitalize="off"
              spellCheck={false}
            />
          </label>
        )}
        <label>
          Extra arguments (optional)
          <input
            value={args}
            onChange={(e) => setArgs(e.target.value)}
            placeholder="--model fast"
            autoCapitalize="off"
            spellCheck={false}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={useWorktree}
            onChange={(e) => setUseWorktree(e.target.checked)}
          />
          Allow the agent to request a git worktree
        </label>
        {error !== null && <p className="notice error">{error}</p>}
        <div className="row">
          <button type="submit" className="primary" disabled={busy || provider === ''}>
            Start
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
