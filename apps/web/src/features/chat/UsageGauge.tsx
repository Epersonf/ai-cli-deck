import type { ChatUsage } from '@deck/shared';
import { useT } from '../../shared/i18n/store';
import { sendChat } from './connection';
import { HeaderPopover } from './HeaderPopover';
import { Bar, useNow } from './usageParts';
import {
  cacheLeft,
  cacheShare,
  contextFill,
  cost,
  percent,
  tokens,
  untilReset,
} from './usageFormat';

interface Props {
  usage: ChatUsage | null;
  sessionId: string;
  /** The agent takes `/compact` as a message. */
  canCompact: boolean;
}

/** Brass gauges for the chat's context, cache, cost and the account's limits; unknown parts are left out. */
export function UsageGauge({ usage, sessionId, canCompact }: Props) {
  const t = useT();
  const now = useNow(usage?.cache != null, 15_000);
  // Always there: opening it asks the account's limits, which can be known before the first answer.
  const empty: ChatUsage = {
    costUsd: null,
    contextTokens: null,
    contextWindow: null,
    limits: [],
    cache: null,
  };
  const shown = usage ?? empty;
  const fill = contextFill(shown);
  const { limits, cache, costUsd, contextTokens, contextWindow } = shown;
  const nothing = fill === null && costUsd === null && limits.length === 0 && cache === null;
  // The button shows the window closest to running out.
  const worst = limits.reduce<(typeof limits)[number] | null>(
    (top, l) => (top === null || l.used > top.used ? l : top),
    null,
  );
  const left = cache ? cacheLeft(cache, now) : null;
  const share = cache ? cacheShare(cache) : null;
  const compact = (): void =>
    sendChat(sessionId, { type: 'send', text: '/compact', images: [], queue: true });
  return (
    <HeaderPopover
      title={t('chat.usage')}
      className="usage"
      onOpen={() => sendChat(sessionId, { type: 'usage-refresh' })}
      label={
        <>
          {fill !== null && <Bar fraction={fill} label={t('chat.usage.context')} />}
          {worst !== null && (
            <Bar fraction={worst.used} label={worst.label ?? t('chat.usage.limit')} />
          )}
          {fill === null && worst === null && costUsd !== null && <span>{cost(costUsd)}</span>}
          {nothing && <span>{t('chat.usage')}</span>}
        </>
      }
    >
      <h3>{t('chat.usage')}</h3>
      {nothing && <p className="hint">{t('chat.usage.empty')}</p>}
      {fill !== null && contextTokens !== null && contextWindow !== null && (
        <div className="usage-row">
          <span>{t('chat.usage.context')}</span>
          <small>
            {tokens(contextTokens)} / {tokens(contextWindow)} · {percent(fill)}
          </small>
          <Bar fraction={fill} label={t('chat.usage.context')} />
          {canCompact && (
            <button
              type="button"
              className="usage-action"
              onClick={compact}
              title={t('chat.usage.compact.hint')}
            >
              {t('chat.usage.compact')}
            </button>
          )}
        </div>
      )}
      {cache !== null && (
        <div className="usage-row" title={t('chat.usage.cache')}>
          <span>{t('chat.usage.cache')}</span>
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
              write: tokens(cache.write),
            })}
          </small>
        </div>
      )}
      {limits.map((limit) => (
        <div className="usage-row" key={limit.key}>
          <span>{limit.label ?? t('chat.usage.limit')}</span>
          <small>
            {percent(limit.used)}
            {limit.resetsAt !== null &&
              ` · ${t('chat.usage.resets', { time: untilReset(limit.resetsAt, now) })}`}
          </small>
          <Bar fraction={limit.used} label={limit.label ?? t('chat.usage.limit')} />
        </div>
      ))}
      {costUsd !== null && (
        <div className="usage-row">
          <span>{t('chat.usage.cost')}</span>
          <small>{cost(costUsd)}</small>
        </div>
      )}
    </HeaderPopover>
  );
}
