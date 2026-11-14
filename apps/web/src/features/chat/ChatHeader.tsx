import type { ChatUsage, Session } from '@deck/shared';
import { useT } from '../../shared/i18n/store';
import { CopyIcon } from '../../shared/ui/ToolIcons';
import { TransferIcon } from '../../shared/ui/Icons';
import { KebabMenu } from '../../shared/ui/KebabMenu';
import { useConfirm } from '../confirm/confirmStore';
import { useFork } from '../sessions/forkStore';
import { useSessions } from '../sessions/sessionsStore';
import { useMemory } from '../memory/memoryStore';
import { useSignIn } from '../signin/signInStore';
import { sideChatsOf, useSide } from '../side/sideStore';
import { copyText } from '../settings/templateFile';
import { toast } from '../../shared/ui/toast';
import type { Block } from './blocks';
import { ChatTasks } from './ChatTasks';
import type { ChatTask } from './tasks';
import { useChats } from './chatStore';
import { UsageGauge } from './UsageGauge';
import { transcript } from './transcript';
import { ForkIcon } from '../../shared/ui/GlyphIcons';

interface Props {
  session: Session;
  blocks: readonly Block[];
  online: boolean;
  tasks: readonly ChatTask[];
  usage: ChatUsage | null;
}

/** The strip over a chat: where it is based, whether it is connected, and its menu. */
export function ChatHeader({ session, blocks, online, tasks, usage }: Props) {
  const t = useT();
  const ask = useConfirm((x) => x.ask);
  const sideCount = useSessions((s) => sideChatsOf(s.sessions, session.id).length);
  const isMain = session.parentId === null;
  const config = useChats((s) => s.byId[session.id]?.config);
  const busy = useChats((s) => s.byId[session.id]?.busy ?? false);
  const openSide = (): void =>
    void useSide
      .getState()
      .start(session.id)
      .catch((e: unknown) =>
        ask({
          title: t('side.title'),
          message: e instanceof Error ? e.message : 'failed',
          confirmLabel: t('common.close'),
          cancelLabel: t('common.cancel'),
          onConfirm: () => undefined,
        }),
      );
  return (
    <div className="chat-header">
      <span className={`dot ${session.status}${online ? '' : ' offline'}`} aria-hidden />
      <span className="chat-cwd" title={session.cwd}>
        {session.cwd}
      </span>
      {!online && <span className="chat-offline">{t('chat.reconnecting')}</span>}
      <UsageGauge
        usage={usage}
        sessionId={session.id}
        canCompact={Boolean(config?.chatId) && (config?.canCompact ?? config?.agent === 'claude')}
        nativeCompact={config?.agent === 'codex'}
        busy={busy || !online}
        compacting={config?.compacting ?? false}
      />
      <ChatTasks sessionId={session.id} tasks={tasks} />
      {sideCount > 0 && (
        <button type="button" className="header-pop-btn" title={t('side.title')} onClick={openSide}>
          <ForkIcon size={16} /> <span className="badge">{sideCount}</span>
        </button>
      )}
      <KebabMenu
        items={[
          {
            label: t('memory.title'),
            onSelect: () => useMemory.getState().show(session.provider),
          },
          { label: t('signin.menu'), onSelect: () => useSignIn.getState().open(session.provider) },
          {
            label: t('chat.copyAll'),
            icon: <CopyIcon size={16} />,
            onSelect: () =>
              void copyText(transcript(blocks))
                .then(() => toast(t('files.copied')))
                .catch(() => undefined),
          },
          ...(isMain
            ? [
                { label: t('side.menu'), onSelect: openSide },
                {
                  label: t('fork.menu'),
                  icon: <TransferIcon size={16} />,
                  onSelect: () => useFork.getState().open(session),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
