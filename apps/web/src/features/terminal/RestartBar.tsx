import { RESUME_KEY } from '@deck/shared';
import { useState } from 'react';
import { api } from '../../shared/api/endpoints';
import { useT } from '../../shared/i18n/store';
import { useSessions } from '../sessions/sessionsStore';

/**
 * Shown over an ended terminal. If the agent saved how to continue its chat ("resume" note) you can
 * pick that up again, otherwise the same CLI just starts fresh in the same folder and profile.
 */
export function RestartBar({ sessionId }: { sessionId: string }) {
  const t = useT();
  const session = useSessions((s) => s.sessions.find((x) => x.id === sessionId));
  const [busy, setBusy] = useState(false);
  if (session?.status !== 'exited') return null;
  const canResume = Boolean(session.meta[RESUME_KEY]);
  const go = (resume: boolean): void => {
    setBusy(true);
    void api.restartSession(sessionId, resume).finally(() => setBusy(false));
  };
  return (
    <div className="restart-bar">
      <button type="button" className="primary" disabled={busy} onClick={() => go(canResume)}>
        {canResume ? t('terminal.resume') : t('terminal.restart')}
      </button>
      {canResume && (
        <button type="button" disabled={busy} onClick={() => go(false)}>
          {t('terminal.restartNew')}
        </button>
      )}
    </div>
  );
}
