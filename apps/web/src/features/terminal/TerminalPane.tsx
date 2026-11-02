import { useRef } from 'react';
import { ExtraKeys } from './ExtraKeys';
import { TerminalView, type TerminalApi } from './TerminalView';
import { useModifiers } from './useModifiers';

interface Props {
  sessionId: string;
  visible: boolean;
  extraKeys: readonly string[] | null;
  showKeys: boolean;
}

/** One terminal plus its extra-keys bar; stays mounted while hidden so output keeps flowing. */
export function TerminalPane({ sessionId, visible, extraKeys, showKeys }: Props) {
  const mods = useModifiers();
  const api = useRef<TerminalApi | null>(null);
  return (
    <section className={`pane terminal-pane${visible ? '' : ' hidden'}`}>
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
