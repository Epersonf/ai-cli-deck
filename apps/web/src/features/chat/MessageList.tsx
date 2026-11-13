import { useRef, type ReactNode } from 'react';
import { useT } from '../../shared/i18n/store';
import { Gear } from '../../shared/ui/Gear';
import type { Block } from './blocks';
import { MessageRow } from './MessageRow';
import { TodoPanel } from './TodoPanel';
import { useStickToBottom } from './useStickToBottom';

interface Props {
  sessionId: string;
  blocks: readonly Block[];
  busy: boolean;
  empty: ReactNode;
}

/** The conversation, scrolled to its end while the person reads the end. */
export function MessageList({ sessionId, blocks, busy, empty }: Props) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const { onScroll, away, jump } = useStickToBottom(box, blocks);
  return (
    <div className="chat-scroll-wrap">
      <div className="chat-scroll" ref={box} onScroll={onScroll}>
        <div className="chat-column">
          <TodoPanel blocks={blocks} />
          {blocks.length === 0 && empty}
          {blocks.map((block) => (
            <MessageRow
              key={`${block.kind}-${block.id}`}
              block={block}
              sessionId={sessionId}
              busy={busy}
            />
          ))}
          {busy && (
            <div className="working" role="status" aria-label={t('chat.working')}>
              <Gear size={30} teeth={9} className="working-gear" />
              <Gear size={18} teeth={7} className="working-gear back" />
            </div>
          )}
        </div>
      </div>
      {away && (
        <button type="button" className="jump-latest" onClick={jump}>
          ↓ {t('chat.jump')}
        </button>
      )}
    </div>
  );
}
