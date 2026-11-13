import { useT } from '../../shared/i18n/store';
import { sendChat } from './connection';
import { useQueue, type Queued } from './queueStore';

/** Messages waiting for the answer to end, each with Send now (goes in at once) and a way to drop it. */
export function QueueList({ sessionId, items }: { sessionId: string; items: readonly Queued[] }) {
  const t = useT();
  if (items.length === 0) return null;
  const sendNow = (id: number): void => {
    const q = useQueue.getState().take(sessionId, id);
    if (q) sendChat(sessionId, { type: 'send', text: q.text, images: q.images });
  };
  return (
    <ul className="queue-list" aria-label={t('chat.queue')}>
      {items.map((q) => (
        <li key={q.id}>
          <span className="queue-text" title={q.text}>
            {q.text || `+${q.images.length}`}
          </span>
          <button type="button" onClick={() => sendNow(q.id)}>
            {t('chat.queue.now')}
          </button>
          <button
            type="button"
            aria-label={t('chat.queue.remove')}
            title={t('chat.queue.remove')}
            onClick={() => useQueue.getState().remove(sessionId, q.id)}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}
