import { useRef, useState, type KeyboardEvent } from 'react';
import { QuickPrompts } from '../prompts/QuickPrompts';
import { sendPrompt } from '../prompts/promptsStore';
import { ExtraKeys } from './ExtraKeys';
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

/** One terminal plus its bars (search, quick prompts, extra keys); stays mounted while hidden so output keeps flowing. */
export function TerminalPane({ sessionId, visible, extraKeys, showKeys }: Props) {
  const mods = useModifiers();
  const api = useRef<TerminalApi | null>(null);
  const [searching, setSearching] = useState(false);
  const send = (data: string): void => api.current?.send(data);
  return (
    <section
      className={`pane terminal-pane${visible ? '' : ' hidden'}`}
      onKeyDownCapture={(e) => {
        if (!isSearchKey(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setSearching(true);
      }}
    >
      {searching && <TerminalSearch api={api} onClose={() => setSearching(false)} />}
      <TerminalView sessionId={sessionId} visible={visible} mods={mods} apiRef={api} />
      <QuickPrompts
        onSearch={() => setSearching((open) => !open)}
        onPrompt={(prompt) => {
          const terminal = api.current;
          if (terminal) sendPrompt(prompt, terminal.paste, terminal.send);
        }}
      />
      {showKeys && (
        <ExtraKeys
          keys={extraKeys}
          mods={mods}
          send={send}
          applicationCursor={() => api.current?.applicationCursor() ?? false}
        />
      )}
    </section>
  );
}
