import { useT } from '../../shared/i18n/store';
import { ModalTitle } from '../../shared/ui/ModalTitle';
import { sendChat } from './connection';
import type { Queued } from './queueStore';

interface Props {
  sessionId: string;
  items: readonly Queued[];
  onDone(): void;
}

/** Stop was pressed while messages wait in the queue: cancel them too, or let them go out after the stop. */
export function StopQueueDialog({ sessionId, items, onDone }: Props) {
  const t = useT();
  const stop = (clear: boolean): void => {
    if (clear) for (const q of items) sendChat(sessionId, { type: 'queue-drop', id: q.id });
    sendChat(sessionId, { type: 'interrupt' });
    onDone();
  };
  return (
    <div className="modal-backdrop" onClick={onDone}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <ModalTitle title={t('chat.stop')} onClose={onDone} />
        <p className="hint confirm-text">{t('chat.queue.stopAsk', { n: items.length })}</p>
        <button type="button" className="danger" onClick={() => stop(true)}>
          {t('chat.queue.stopClear')}
        </button>
        <button type="button" onClick={() => stop(false)}>
          {t('chat.queue.stopKeep')}
        </button>
        <button type="button" onClick={onDone}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
