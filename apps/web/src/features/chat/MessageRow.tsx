import { stripAuth } from '../signin/authError';
import { memo } from 'react';
import { useT } from '../../shared/i18n/store';
import type { Block } from './blocks';
import { Markdown } from './Markdown';
import { PermissionCard } from './PermissionCard';
import { ToolCard } from './ToolCard';
import { UserMessage } from './UserMessage';

const seconds = (ms: number): string =>
  ms < 10_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 1000)}s`;

interface Props {
  block: Block;
  sessionId: string;
  busy: boolean;
}

/** One row of the conversation. */
export const MessageRow = memo(function MessageRow({ block, sessionId, busy }: Props) {
  const t = useT();
  switch (block.kind) {
    case 'user':
      return (
        <UserMessage
          sessionId={sessionId}
          id={block.id}
          text={block.text}
          attachments={block.attachments}
          busy={busy}
        />
      );
    case 'text':
      return (
        <div className={`msg assistant${block.streaming ? ' streaming' : ''}`}>
          <Markdown text={block.text} sessionId={sessionId} />
        </div>
      );
    case 'thinking':
      return (
        <details className="msg thinking">
          <summary>{block.streaming ? t('chat.thinkingNow') : t('chat.thinking')}</summary>
          <p>{block.text}</p>
        </details>
      );
    case 'tool':
      return <ToolCard block={block} />;
    case 'permission':
      return <PermissionCard block={block} sessionId={sessionId} />;
    case 'notice':
      return <p className={`notice-row ${block.level}`}>{block.text}</p>;
    case 'turn': {
      const parts = [
        block.durationMs === null ? '' : seconds(block.durationMs),
        block.costUsd === null ? '' : `$${block.costUsd.toFixed(block.costUsd < 0.1 ? 4 : 2)}`,
      ].filter(Boolean);
      return (
        <div className="turn-end">
          {block.error !== null && <p className="notice error">{stripAuth(block.error)}</p>}
          {parts.length > 0 && <small>{parts.join(' · ')}</small>}
        </div>
      );
    }
  }
});
