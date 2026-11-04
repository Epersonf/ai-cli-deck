import { FORK_KEY, type Session } from '@deck/shared';
import { useState, type FormEvent } from 'react';
import { useT } from '../../shared/i18n/store';
import { forkChoices } from './forkChoices';
import { useFork } from './forkStore';
import { useProfiles } from './profilesStore';
import { useForkFlow } from './useForkFlow';

/** Fork a terminal into any profile, or move it (fork, then end the original). */
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
  const flow = useForkFlow(source, close);
  const native = provider === source.provider && Boolean(source.meta[FORK_KEY]);
  const waiting = flow.phase === 'waiting';
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (!waiting) void flow.run(provider, endAfter);
  };

  return (
    <div className="modal-backdrop confirm-backdrop" onClick={waiting ? undefined : close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('fork.title')}</h2>
        <p className="hint">{t('fork.intro')}</p>
        <form className="profile-form" onSubmit={submit}>
          <label>
            {t('fork.profile')}
            <select
              value={provider}
              disabled={waiting}
              onChange={(e) => setProvider(e.target.value)}
            >
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
              disabled={waiting}
              onChange={(e) => setEndAfter(e.target.checked)}
            />
            {t('fork.end')}
          </label>
          <p className="hint">{native ? t('fork.native') : t('fork.handoff')}</p>
          {waiting && <p className="notice">{t('fork.waiting')}</p>}
          {flow.error !== null && <p className="notice error">{flow.error}</p>}
          <div className="row">
            {waiting ? (
              <button type="button" onClick={flow.skip}>
                {t('fork.skip')}
              </button>
            ) : (
              <>
                <button type="submit" className="primary">
                  {endAfter ? t('fork.move') : t('fork.go')}
                </button>
                <button type="button" onClick={close}>
                  {t('common.cancel')}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
