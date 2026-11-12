import type { Session } from '@deck/shared';
import { useState, type FormEvent } from 'react';
import { chatApi } from '../../shared/api/chatApi';
import { useT } from '../../shared/i18n/store';
import { forkChoices } from './forkChoices';
import { useFork } from './forkStore';
import { useProfiles } from './profilesStore';
import { useSessions } from './sessionsStore';

/** Fork a terminal's conversation into any profile, or move it (fork, then end the original). */
export function ForkHost() {
  const source = useFork((s) => s.source);
  return source === null ? null : <ForkDialog source={source} />;
}

function ForkDialog({ source }: { source: Session }) {
  const t = useT();
  const close = useFork((s) => s.close);
  const providers = useProfiles((s) => s.providers);
  const options = forkChoices(providers, source.provider);
  const [provider, setProvider] = useState(source.provider);
  const [endAfter, setEndAfter] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const copy = await chatApi.fork(source.id, { provider });
      const sessions = useSessions.getState();
      sessions.upsert(copy);
      sessions.select(copy.id);
      if (endAfter) await sessions.remove(source.id);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop confirm-backdrop" onClick={busy ? undefined : close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('fork.title')}</h2>
        <p className="hint">{t('fork.intro')}</p>
        <form className="profile-form" onSubmit={(e) => void submit(e)}>
          <label>
            {t('fork.profile')}
            <select value={provider} disabled={busy} onChange={(e) => setProvider(e.target.value)}>
              {options.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={endAfter}
              disabled={busy}
              onChange={(e) => setEndAfter(e.target.checked)}
            />
            {t('fork.end')}
          </label>
          <p className="hint">
            {provider === source.provider ? t('fork.native') : t('fork.handoff')}
          </p>
          {error !== null && <p className="notice error">{error}</p>}
          <div className="dialog-actions">
            <button type="submit" className="primary" disabled={busy}>
              {endAfter ? t('fork.move') : t('fork.go')}
            </button>
            <button type="button" disabled={busy} onClick={close}>
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
