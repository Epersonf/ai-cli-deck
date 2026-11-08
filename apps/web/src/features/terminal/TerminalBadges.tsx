import type { MutableRefObject } from 'react';
import { useT } from '../../shared/i18n/store';
import { CopyOverlay } from './CopyOverlay';
import type { Latency } from './latencyMeter';
import type { TerminalApi } from './terminalApi';
import { useTerminalTools } from './toolsStore';

interface Props {
  sessionId: string;
  online: boolean;
  following: boolean;
  latency: Latency;
  api: MutableRefObject<TerminalApi | null>;
  /** Make this device the one that sets the size. */
  claim(): void;
}

/** What floats over the terminal: "following another device", the link latency, "reconnecting". */
export function TerminalBadges({ sessionId, online, following, latency, api, claim }: Props) {
  const t = useT();
  const selecting = useTerminalTools((s) => s.selecting === sessionId);
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
      {selecting && (
        <CopyOverlay
          text={(scope) => api.current?.text(scope) ?? ''}
          onClose={() => useTerminalTools.getState().select(null)}
        />
      )}
    </>
  );
}
