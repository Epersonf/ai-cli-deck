import type { Session } from '@deck/shared';
import { useT } from '../../shared/i18n/store';
import { sessionLabel } from './sessionLabel';
import { useSessions } from './sessionsStore';

/** Confirms, then stops a session; shared by the tab strip and the terminal switcher. */
export function useCloseSession(): (session: Session) => void {
  const t = useT();
  return (session) => {
    if (window.confirm(t('tabs.closeConfirm', { name: sessionLabel(session) }))) {
      void useSessions
        .getState()
        .remove(session.id)
        .catch(() => undefined);
    }
  };
}
