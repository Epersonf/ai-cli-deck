import { useT } from '../../shared/i18n/store';
import { sendChat } from './connection';
import type { Queued } from './queueStore';

/** Messages waiting for the answer to end, each with Send now (goes in at once) and a way to drop it. */
export function QueueList({ sessionId, items }: { sessionId: string; items: readonly Queued[] }) {
  const t = useT();
  if (items.length === 0) return null;
  return (
    <ul className="queue-list" aria-label={t('chat.queue')}>
      {items.map((q) => (
        <li key={q.id}>
          <span className="queue-text" title={q.text}>
            {q.text || `+${q.images}`}
          </span>
          <button
            type="button"
            onClick={() => sendChat(sessionId, { type: 'queue-now', id: q.id })}
          >
            {t('chat.queue.now')}
          </button>
          <button
            type="button"
            aria-label={t('chat.queue.remove')}
            title={t('chat.queue.remove')}
            onClick={() => sendChat(sessionId, { type: 'queue-drop', id: q.id })}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}
