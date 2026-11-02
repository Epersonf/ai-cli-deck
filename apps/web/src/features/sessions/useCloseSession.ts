import type { Session } from '@deck/shared';
import { useT } from '../../shared/i18n/store';
import { useConfirm } from '../confirm/confirmStore';
import { sessionLabel } from './sessionLabel';
import { useSessions } from './sessionsStore';

/** Asks (with the app's own dialog), then stops a session. */
export function useCloseSession(): (session: Session) => void {
  const t = useT();
  const ask = useConfirm((s) => s.ask);
  return (session) =>
    ask({
      title: t('confirm.closeTitle'),
      message: t('tabs.closeConfirm', { name: sessionLabel(session) }),
      confirmLabel: t('confirm.closeAction'),
      cancelLabel: t('confirm.keep'),
      onConfirm: () => {
        void useSessions
          .getState()
          .remove(session.id)
          .catch(() => undefined);
      },
    });
}
