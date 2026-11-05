import type { ISearchOptions } from '@xterm/addon-search';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useT } from '../../shared/i18n/store';
import type { TerminalApi } from './terminalApi';

const OPTIONS: ISearchOptions = {
  decorations: {
    matchBackground: '#5a4320',
    matchOverviewRuler: '#b98a3e',
    activeMatchBackground: '#ffb43a',
    activeMatchColorOverviewRuler: '#ffb43a',
  },
};

interface Props {
  api: MutableRefObject<TerminalApi | null>;
  onClose(): void;
}

/** Finds text in the terminal's scrollback: every match marked, Enter / Shift+Enter step through them. */
export function TerminalSearch({ api, onClose }: Props) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ index: number; count: number } | null>(null);

  useEffect(() => {
    input.current?.focus();
    const search = api.current?.search;
    if (!search) return;
    const listener = search.onDidChangeResults(({ resultIndex, resultCount }) =>
      setFound({ index: resultIndex, count: resultCount }),
    );
    return () => {
      listener.dispose();
      search.clearDecorations();
    };
  }, [api]);

  const find = (text: string, forward: boolean, incremental = false): void => {
    const search = api.current?.search;
    if (!search) return;
    if (text === '') {
      search.clearDecorations();
      setFound(null);
    } else if (forward) search.findNext(text, { ...OPTIONS, incremental });
    else search.findPrevious(text, OPTIONS);
  };

  const label =
    found === null
      ? ''
      : found.count === 0
        ? t('search.none')
        : `${found.index + 1}/${found.count}`;
  return (
    <div className="terminal-search" role="search">
      <input
        ref={input}
        type="search"
        value={query}
        placeholder={t('search.placeholder')}
        aria-label={t('search.placeholder')}
        enterKeyHint="search"
        onChange={(e) => {
          setQuery(e.target.value);
          find(e.target.value, true, true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Enter') find(query, !e.shiftKey);
        }}
      />
      <span className="terminal-search-count">{label}</span>
      <button
        type="button"
        className="tool"
        title={t('search.previous')}
        onClick={() => find(query, false)}
      >
        ↑
      </button>
      <button
        type="button"
        className="tool"
        title={t('search.next')}
        onClick={() => find(query, true)}
      >
        ↓
      </button>
      <button type="button" className="tool" title={t('search.close')} onClick={onClose}>
        ✕
      </button>
    </div>
  );
}
