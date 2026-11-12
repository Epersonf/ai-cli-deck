import type { Session } from '@deck/shared';
import { useT } from '../../shared/i18n/store';
import { ChatPane } from '../chat/ChatPane';
import { useConfirm } from '../confirm/confirmStore';
import { useSessions } from '../sessions/sessionsStore';
import { useSide } from './sideStore';

interface Props {
  child: Session;
  /** The main chat it hangs off is the one on screen. */
  parentActive: boolean;
}

/** A side chat: a full chat in a brass drawer beside the main one (a sheet on a phone), kept connected while hidden. */
export function SidePane({ child, parentActive }: Props) {
  const t = useT();
  const open = useSide((s) => s.open[child.id] === true);
  const ask = useConfirm((s) => s.ask);
  const shown = open && parentActive;
  const discard = (): void =>
    ask({
      title: t('side.discardTitle'),
      message: t('side.discardBody'),
      confirmLabel: t('side.discard'),
      cancelLabel: t('confirm.keep'),
      onConfirm: () => {
        void useSessions
          .getState()
          .remove(child.id)
          .catch(() => undefined);
      },
    });
  return (
    <aside className={`side-pane${shown ? '' : ' hidden'}`} aria-label={t('side.title')}>
      <div className="side-bar">
        <strong>{t('side.title')}</strong>
        <button type="button" onClick={() => useSide.getState().setOpen(child.id, false)}>
          {t('side.hide')}
        </button>
        <button type="button" className="danger" onClick={discard}>
          {t('side.discard')}
        </button>
      </div>
      <ChatPane sessionId={child.id} visible={shown} />
    </aside>
  );
}
