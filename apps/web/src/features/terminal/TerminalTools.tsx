import { useState, type MutableRefObject } from 'react';
import { useT } from '../../shared/i18n/store';
import { copyText } from '../settings/templateFile';
import type { TextScope } from './bufferText';
import { TerminalSearch } from './TerminalSearch';
import { TerminalSpeak } from './TerminalSpeak';
import type { TerminalApi } from './terminalApi';
import { useTerminalTools, type ToolTab } from './toolsStore';

interface Props {
  sessionId: string;
  api: MutableRefObject<TerminalApi | null>;
}

const TABS: readonly ToolTab[] = ['search', 'copy', 'listen'];

/** The tools of a terminal, in a bar above it (never over it): search, copy, and room for more tabs. */
export function TerminalTools({ sessionId, api }: Props) {
  const t = useT();
  const tab = useTerminalTools((s) => s.tab);
  const [note, setNote] = useState('');
  const close = (): void => useTerminalTools.getState().close();

  const copy = (scope: TextScope): void => {
    copyText(api.current?.text(scope) ?? '').then(
      () => setNote(t('terminal.copied')),
      () => setNote(t('terminal.copyFailed')),
    );
  };

  return (
    <div className="terminal-tools" role="toolbar" aria-label={t('tools.open')}>
      <div className="tools-tabs">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            className={`tool${tab === name ? ' on' : ''}`}
            aria-pressed={tab === name}
            onClick={() => (setNote(''), useTerminalTools.getState().setTab(name))}
          >
            {t(`tools.${name}`)}
          </button>
        ))}
        <button type="button" className="tool tools-close" title={t('tools.close')} onClick={close}>
          ✕
        </button>
      </div>
      {tab === 'search' && <TerminalSearch api={api} onClose={close} />}
      {tab === 'listen' && <TerminalSpeak api={api} />}
      {tab === 'copy' && (
        <div className="tools-copy">
          <button type="button" onClick={() => copy('screen')}>
            {t('tools.copyScreen')}
          </button>
          <button type="button" onClick={() => copy('all')}>
            {t('tools.copyHistory')}
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => useTerminalTools.getState().select(sessionId)}
          >
            {t('tools.select')}
          </button>
          {note !== '' && <span className="tools-note">{note}</span>}
        </div>
      )}
    </div>
  );
}
