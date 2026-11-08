import { useState, type MutableRefObject, type ReactNode } from 'react';
import { useT } from '../../shared/i18n/store';
import { SearchIcon } from '../../shared/ui/Icons';
import {
  CloseIcon,
  CopyIcon,
  HistoryIcon,
  SelectIcon,
  SpeakerIcon,
} from '../../shared/ui/ToolIcons';
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

const TABS: { name: ToolTab; icon: ReactNode }[] = [
  { name: 'search', icon: <SearchIcon size={22} /> },
  { name: 'copy', icon: <CopyIcon /> },
  { name: 'listen', icon: <SpeakerIcon /> },
];

/** The tools of a terminal, in a bar above it (never over it): search, copy, listen, and room for more tabs. */
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
        {TABS.map(({ name, icon }) => (
          <button
            key={name}
            type="button"
            className={`tool-tab${tab === name ? ' on' : ''}`}
            aria-pressed={tab === name}
            aria-label={t(`tools.${name}`)}
            title={t(`tools.${name}`)}
            onClick={() => (setNote(''), useTerminalTools.getState().setTab(name))}
          >
            {icon}
          </button>
        ))}
        <button
          type="button"
          className="tools-x"
          aria-label={t('tools.close')}
          title={t('tools.close')}
          onClick={close}
        >
          <CloseIcon size={20} />
        </button>
      </div>
      {tab === 'search' && <TerminalSearch api={api} onClose={close} />}
      {tab === 'listen' && <TerminalSpeak api={api} />}
      {tab === 'copy' && (
        <div className="tools-actions">
          <button type="button" className="tool-action" onClick={() => copy('screen')}>
            <CopyIcon size={24} />
            <span>{t('tools.copyScreen')}</span>
          </button>
          <button type="button" className="tool-action" onClick={() => copy('all')}>
            <HistoryIcon size={24} />
            <span>{t('tools.copyHistory')}</span>
          </button>
          <button
            type="button"
            className="tool-action primary"
            onClick={() => useTerminalTools.getState().select(sessionId)}
          >
            <SelectIcon size={24} />
            <span>{t('tools.select')}</span>
          </button>
          {note !== '' && <span className="tools-note">{note}</span>}
        </div>
      )}
    </div>
  );
}
