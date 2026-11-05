import type { RestartSessionBody, SessionChat } from '@deck/shared';
import { useEffect, useState } from 'react';
import { chatApi } from '../../shared/api/chatApi';
import { useT } from '../../shared/i18n/store';
import { forkChoices } from '../sessions/forkChoices';
import { useProfiles } from '../sessions/profilesStore';
import { useSessions } from '../sessions/sessionsStore';

const SHELL = 'shell';

/**
 * Over an ended terminal: continue its conversation (the CLI's own resume, or handed over from its chat
 * files), start a new one, or carry it on with another AI. A plain shell just restarts.
 */
export function RestartBar({ sessionId }: { sessionId: string }) {
  const t = useT();
  const session = useSessions((s) => s.sessions.find((x) => x.id === sessionId));
  const providers = useProfiles((s) => s.providers);
  const [info, setInfo] = useState<SessionChat | null>(null);
  const [other, setOther] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ended = session?.status === 'exited';
  const conversational = session !== undefined && session.provider !== SHELL;

  useEffect(() => {
    if (!ended || !conversational) return setInfo(null);
    let live = true;
    chatApi
      .info(sessionId)
      .then((next) => live && setInfo(next))
      .catch(() => undefined);
    return () => void (live = false);
  }, [ended, conversational, sessionId]);

  if (!session || !ended) return null;
  const run = (body: RestartSessionBody): void => {
    setBusy(true);
    setError(null);
    chatApi
      .restart(sessionId, body)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'failed'))
      .finally(() => setBusy(false));
  };
  const canContinue = conversational && info?.canContinue === true;
  const others = forkChoices(providers, session.provider).filter(
    (p) => p.id !== session.provider && p.id !== SHELL,
  );

  return (
    <div className="restart-bar">
      {info?.chat && (
        <p className="restart-chat" title={info.chat.title}>
          {t('chat.last', { title: info.chat.title })}
        </p>
      )}
      <div className="row">
        {canContinue && (
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => run({ mode: 'continue' })}
          >
            {t('chat.continue')}
          </button>
        )}
        <button
          type="button"
          className={canContinue ? '' : 'primary'}
          disabled={busy}
          onClick={() => run({ mode: 'new' })}
        >
          {conversational ? t('chat.new') : t('terminal.restart')}
        </button>
      </div>
      {canContinue && others.length > 0 && (
        <div className="row">
          <select
            value={other}
            disabled={busy}
            onChange={(e) => setOther(e.target.value)}
            aria-label={t('chat.otherAi')}
          >
            <option value="">{t('chat.otherAi')}</option>
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || other === ''}
            onClick={() => run({ mode: 'continue', provider: other })}
          >
            {t('chat.move')}
          </button>
        </div>
      )}
      {error !== null && <p className="notice error">{error}</p>}
    </div>
  );
}
