import type { UsageCache, UsageHistory } from '@deck/shared';
import { useT } from '../../shared/i18n/store';
import { Bar } from './usageParts';
import { cacheLeft, cacheShare, percent, tokens, untilReset } from './usageFormat';

/** Last request/turn cache figures are separate from lifetime token totals. */
export function CacheDetails({ cache, now }: { cache: UsageCache; now: number }) {
  const t = useT();
  const left = cacheLeft(cache, now);
  const share = cacheShare(cache);
  const label =
    cache.scope === 'turn'
      ? 'chat.usage.cache.turn'
      : cache.scope === 'request'
        ? 'chat.usage.cache.request'
        : 'chat.usage.cache';
  return (
    <div className="usage-row" title={t('chat.usage.cache')}>
      <span>{t(label)}</span>
      <small>
        {left === null
          ? ''
          : left > 0
            ? t('chat.usage.cache.left', {
                time: untilReset(new Date(now + left).toISOString(), now),
              })
            : t('chat.usage.cache.expired')}
      </small>
      {cache.ttlMs !== null && left !== null && (
        <Bar
          fraction={left / cache.ttlMs}
          tone={1 - left / cache.ttlMs}
          label={t('chat.usage.cache')}
        />
      )}
      <small className="usage-wide">
        {t('chat.usage.cache.rw', {
          read: tokens(cache.read),
          share: share === null ? '–' : percent(share),
          write: tokens((cache.write ?? 0) + (cache.uncached ?? 0)),
        })}
      </small>
      {cache.write !== null && (
        <small className="usage-wide">
          {t('chat.usage.cache.written', { write: tokens(cache.write) })}
        </small>
      )}
    </div>
  );
}

export function HistoryDetails({ history }: { history: UsageHistory }) {
  const t = useT();
  const last = history.recent.at(-1);
  return (
    <div className="usage-row">
      <span>{t('chat.usage.history')}</span>
      <small className="usage-wide">
        {t('chat.usage.totals', {
          turns: String(history.turns),
          input: tokens(history.input),
          cached: tokens(history.cached),
          share: history.input > 0 ? percent(history.cached / history.input) : '–',
          output: tokens(history.output),
        })}
      </small>
      {last && (
        <small className="usage-wide">
          {t('chat.usage.lastTurn', {
            input: tokens(last.input),
            cached: tokens(last.cached),
            time: (last.durationMs / 1000).toFixed(1),
          })}
        </small>
      )}
    </div>
  );
}
