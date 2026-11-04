import { useT } from '../../shared/i18n/store';
import type { Latency } from './latencyMeter';

interface Props {
  online: boolean;
  following: boolean;
  latency: Latency;
  /** Make this device the one that sets the size. */
  claim(): void;
}

/** What floats over the terminal: "following another device", the link latency, "reconnecting". */
export function TerminalBadges({ online, following, latency, claim }: Props) {
  const t = useT();
  return (
    <>
      {following && (
        <button type="button" className="terminal-follow" onClick={claim}>
          {t('terminal.following')}
        </button>
      )}
      {online && latency.net !== null && (
        <div className="terminal-latency" title={t('terminal.latencyTip')}>
          {`${Math.round(latency.net)} ms`}
          {latency.echo !== null && ` · ${Math.round(latency.echo)} ms`}
        </div>
      )}
      {!online && <div className="terminal-offline">{t('terminal.reconnecting')}</div>}
    </>
  );
}
