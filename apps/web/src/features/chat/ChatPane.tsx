import { RetryBanner } from './RetryBanner';
import '../../styles/chatRetry.css';
import { useEffect } from 'react';
import { useT } from '../../shared/i18n/store';
import { Gear } from '../../shared/ui/Gear';
import { AuthBanner } from '../signin/AuthBanner';
import { authFailed } from '../signin/authError';
import { useProfiles } from '../sessions/profilesStore';
import { sessionLabel } from '../sessions/sessionLabel';
import { useSessions } from '../sessions/sessionsStore';
import { useChat } from './chatStore';
import { ChatHeader } from './ChatHeader';
import { Composer } from './Composer';
import { connectChat, sendChat } from './connection';
import { MessageList } from './MessageList';
import { useReadAloud } from './useReadAloud';
import { ModeModelBar } from './ModeModelBar';

interface Props {
  sessionId: string;
  visible: boolean;
}

/** Tells the server while this chat is on screen and the page is visible, so it skips the "finished" notifications. */
function useReportViewing(sessionId: string, visible: boolean, online: boolean): void {
  useEffect(() => {
    if (!online) return;
    const report = (): void =>
      sendChat(sessionId, { type: 'viewing', viewing: visible && !document.hidden });
    report();
    document.addEventListener('visibilitychange', report);
    return () => {
      document.removeEventListener('visibilitychange', report);
      sendChat(sessionId, { type: 'viewing', viewing: false });
    };
  }, [sessionId, visible, online]);
}

/** One session's chat; stays mounted (and connected) while hidden so the conversation keeps flowing. */
export function ChatPane({ sessionId, visible }: Props) {
  const t = useT();
  const session = useSessions((s) => s.sessions.find((x) => x.id === sessionId));
  const providers = useProfiles((s) => s.providers);
  const chat = useChat(sessionId);
  useEffect(() => connectChat(sessionId), [sessionId]);
  useReportViewing(sessionId, visible, chat.online);
  useReadAloud(chat.blocks, chat.loaded, visible);
  if (!session) return null;
  const lastUser = [...chat.blocks].reverse().find((b) => b.kind === 'user');

  const provider = providers.find((p) => p.id === session.provider);
  const empty = chat.loaded && (
    <div className="chat-empty">
      <Gear size={72} teeth={12} className="spin" />
      <h2>{sessionLabel(session, providers)}</h2>
      <p>{t('chat.empty')}</p>
    </div>
  );
  return (
    <section className={`pane chat-pane${visible ? '' : ' hidden'}`}>
      <ChatHeader
        session={session}
        blocks={chat.blocks}
        online={chat.online}
        tasks={chat.tasks}
        usage={chat.usage}
      />
      {(provider?.keyState === 'missing' || authFailed(chat.blocks)) && (
        <AuthBanner
          provider={session.provider}
          lastText={lastUser?.kind === 'user' ? lastUser.text : null}
          onResend={(text) => sendChat(sessionId, { type: 'send', text, images: [] })}
        />
      )}
      {chat.config?.retry && (
        <RetryBanner sessionId={sessionId} retry={chat.config.retry} online={chat.online} />
      )}
      <MessageList
        sessionId={sessionId}
        blocks={chat.blocks}
        busy={chat.busy && !chat.config?.retry}
        empty={empty}
      />
      {chat.config && <ModeModelBar sessionId={sessionId} config={chat.config} />}
      <Composer sessionId={sessionId} busy={chat.busy} visible={visible} />
    </section>
  );
}
