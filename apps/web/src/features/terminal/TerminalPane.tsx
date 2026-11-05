import { useRef, type KeyboardEvent } from 'react';
import { ExtraKeys } from './ExtraKeys';
import { useTerminalSearch } from './searchStore';
import type { TerminalApi } from './terminalApi';
import { TerminalSearch } from './TerminalSearch';
import { TerminalView } from './TerminalView';
import { useModifiers } from './useModifiers';

interface Props {
  sessionId: string;
  visible: boolean;
  extraKeys: readonly string[] | null;
  showKeys: boolean;
}

/** Ctrl+Shift+F (Cmd+Shift+F on a Mac) opens the search, wherever the focus is in the pane. */
const isSearchKey = (e: KeyboardEvent): boolean =>
  (e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyF';

/** One terminal plus its extra-keys bar; stays mounted while hidden so output keeps flowing. */
export function TerminalPane({ sessionId, visible, extraKeys, showKeys }: Props) {
  const mods = useModifiers();
  const api = useRef<TerminalApi | null>(null);
  const searching = useTerminalSearch((s) => s.openFor === sessionId);
  return (
    <section
      className={`pane terminal-pane${visible ? '' : ' hidden'}`}
      onKeyDownCapture={(e) => {
        if (!isSearchKey(e)) return;
        e.preventDefault();
        e.stopPropagation();
        useTerminalSearch.getState().toggle(sessionId);
      }}
    >
      {searching && (
        <TerminalSearch api={api} onClose={() => useTerminalSearch.getState().close()} />
      )}
      <TerminalView sessionId={sessionId} visible={visible} mods={mods} apiRef={api} />
      {showKeys && (
        <ExtraKeys
          keys={extraKeys}
          mods={mods}
          send={(data) => api.current?.send(data)}
          applicationCursor={() => api.current?.applicationCursor() ?? false}
        />
      )}
    </section>
  );
}
