import { useEffect, useRef } from 'react';

interface AppBridge {
  chatSeen?(sessionId: string): void;
}
interface DeckWindow {
  DeckAndroid?: AppBridge;
  deckOpenChat?: (id: string) => void;
}

/**
 * The Android app opens a chat when its notification is tapped (`?chat=<id>` on start, `deckOpenChat` while running),
 * and drops that chat's notification whenever the chat is on screen.
 */
export function useChatNotifications(
  sessions: readonly { id: string }[],
  activeId: string | null,
  view: string,
  select: (id: string) => void,
): void {
  const known = useRef<ReadonlySet<string>>(new Set());
  known.current = new Set(sessions.map((s) => s.id));
  const wanted = useRef<string | null>(new URLSearchParams(window.location.search).get('chat'));

  useEffect(() => {
    (window as DeckWindow).deckOpenChat = (id) => {
      wanted.current = id;
      if (known.current.has(id)) (select(id), (wanted.current = null));
    };
    return () => {
      delete (window as DeckWindow).deckOpenChat;
    };
  }, [select]);

  // A tap that arrived before the sessions did waits for them.
  useEffect(() => {
    const id = wanted.current;
    if (id && known.current.has(id)) {
      wanted.current = null;
      select(id);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [sessions, select]);

  useEffect(() => {
    if (activeId === null || view !== 'chat') return;
    const clear = (): void => {
      if (!document.hidden) (window as DeckWindow).DeckAndroid?.chatSeen?.(activeId);
    };
    clear();
    document.addEventListener('visibilitychange', clear);
    return () => document.removeEventListener('visibilitychange', clear);
  }, [activeId, view]);
}
