import type { ChatUsage } from '@deck/shared';
import { useT } from '../../shared/i18n/store';
import { HeaderPopover } from './HeaderPopover';
import { band, contextFill, cost, percent, tokens, untilReset } from './usageFormat';

function Bar({ fraction, label }: { fraction: number; label: string }) {
  return (
    <div
      className="gauge"
      role="meter"
      aria-label={label}
      aria-valuenow={Math.round(fraction * 100)}
    >
      <span className={`gauge-fill ${band(fraction)}`} style={{ width: percent(fraction) }} />
    </div>
  );
}

/** Brass gauges for the chat's context, its cost and the account's limit; unknown parts are left out. */
export function UsageGauge({ usage }: { usage: ChatUsage | null }) {
  const t = useT();
  if (!usage) return null;
  const fill = contextFill(usage);
  const { limitUsed, limitResetsAt, limitLabel, costUsd, contextTokens, contextWindow } = usage;
  if (fill === null && costUsd === null && limitUsed === null) return null;
  return (
    <HeaderPopover
      title={t('chat.usage')}
      className="usage"
      label={
        <>
          {fill !== null && <Bar fraction={fill} label={t('chat.usage.context')} />}
          {limitUsed !== null && <Bar fraction={limitUsed} label={t('chat.usage.limit')} />}
          {fill === null && limitUsed === null && costUsd !== null && <span>{cost(costUsd)}</span>}
        </>
      }
    >
      <h3>{t('chat.usage')}</h3>
      {fill !== null && contextTokens !== null && contextWindow !== null && (
        <div className="usage-row">
          <span>{t('chat.usage.context')}</span>
          <small>
            {tokens(contextTokens)} / {tokens(contextWindow)} · {percent(fill)}
          </small>
          <Bar fraction={fill} label={t('chat.usage.context')} />
        </div>
      )}
      {limitUsed !== null && (
        <div className="usage-row">
          <span>{limitLabel ?? t('chat.usage.limit')}</span>
          <small>
            {percent(limitUsed)}
            {limitResetsAt !== null &&
              ` · ${t('chat.usage.resets', { time: untilReset(limitResetsAt) })}`}
          </small>
          <Bar fraction={limitUsed} label={t('chat.usage.limit')} />
        </div>
      )}
      {costUsd !== null && (
        <div className="usage-row">
          <span>{t('chat.usage.cost')}</span>
          <small>{cost(costUsd)}</small>
        </div>
      )}
    </HeaderPopover>
  );
}
