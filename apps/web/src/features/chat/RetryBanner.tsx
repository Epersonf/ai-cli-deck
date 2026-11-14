import type { ChatRetry } from '@deck/shared';
import { useT } from '../../shared/i18n/store';
import { sendChat } from './connection';
import { useNow } from './usageParts';

/** All devices show the server's durable choice; closing this page never cancels the wait. */
export function RetryBanner({
  sessionId,
  retry,
  online,
}: {
  sessionId: string;
  retry: ChatRetry;
  online: boolean;
}) {
  const t = useT();
  const now = useNow(true, 15_000);
  const waiting = retry.status === 'waiting';
  const at = new Date(retry.retryAt);
  const minutes = Math.max(0, Math.ceil((at.getTime() - now) / 60_000));
  const action = (choice: 'wait' | 'now' | 'cancel'): void =>
    sendChat(sessionId, { type: 'retry', id: retry.id, action: choice });
  return (
    <aside className="retry-banner" role="status" aria-live="polite">
      <strong>
        {t(
          waiting
            ? 'retry.waiting'
            : retry.kind === 'overloaded'
              ? 'retry.overloaded'
              : 'retry.limited',
        )}
      </strong>
      <p>
        {t(retry.estimated ? 'retry.estimated' : 'retry.reset', {
          at: at.toLocaleString(),
          minutes: String(minutes),
        })}
      </p>
      <p>{t(waiting ? 'retry.serverWait' : 'retry.offer')}</p>
      {retry.attempt >= 5 && <p>{t('retry.exhausted')}</p>}
      <div className="retry-actions">
        {!waiting && (
          <button type="button" disabled={!online} onClick={() => action('wait')}>
            {t('retry.wait')}
          </button>
        )}
        <button type="button" disabled={!online} onClick={() => action('now')}>
          {t('retry.now')}
        </button>
        <button type="button" disabled={!online} onClick={() => action('cancel')}>
          {t('retry.cancel')}
        </button>
      </div>
    </aside>
  );
}
