import { CacheDetails, HistoryDetails } from './UsageDetails';
import type { ChatUsage } from '@deck/shared';
import { useT } from '../../shared/i18n/store';
import { sendChat } from './connection';
import { HeaderPopover } from './HeaderPopover';
import { Bar, useNow } from './usageParts';
import { contextFill, cost, percent, tokens, untilReset } from './usageFormat';

interface Props {
  usage: ChatUsage | null;
  sessionId: string;
  /** The server detected native manual compaction support. */
  canCompact: boolean;
  /** Codex uses an RPC; Claude retains its existing SDK slash-command transport. */
  nativeCompact?: boolean;
  busy?: boolean;
  compacting?: boolean;
}

/** Brass gauges for the chat's context, cache, cost and the account's limits; unknown parts are left out. */
export function UsageGauge({
  usage,
  sessionId,
  canCompact,
  nativeCompact = false,
  busy = false,
  compacting = false,
}: Props) {
  const t = useT();
  const now = useNow(usage?.cache != null || (usage?.limits.length ?? 0) > 0, 15_000);
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
  const compact = (): void =>
    sendChat(
      sessionId,
      nativeCompact
        ? { type: 'compact' }
        : { type: 'send', text: '/compact', images: [], queue: true },
    );
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
      {canCompact && (
        <button
          type="button"
          className={`usage-chip${fill !== null && fill >= 0.7 ? ' hot' : ''}`}
          onClick={compact}
          disabled={busy}
          title={t('chat.usage.compact.hint')}
        >
          {t(compacting ? 'chat.usage.compacting' : 'chat.usage.compact')}
        </button>
      )}
      {nothing && <p className="hint">{t('chat.usage.empty')}</p>}
      {fill !== null && contextTokens !== null && contextWindow !== null && (
        <div className="usage-row">
          <span className="usage-label">{t('chat.usage.context')}</span>
          <small>
            {tokens(contextTokens)} / {tokens(contextWindow)} · {percent(fill)}
          </small>
          <Bar fraction={fill} label={t('chat.usage.context')} />
        </div>
      )}
      {cache !== null && <CacheDetails cache={cache} now={now} />}
      {shown.history && <HistoryDetails history={shown.history} />}
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
