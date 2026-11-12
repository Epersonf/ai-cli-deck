import type { ClientMessage, ServerMessage } from '@deck/shared';
import { openChatSocket, type ChatSocket } from '../../shared/ws/chatSocket';
import { useApprovals } from '../approvals/approvalsStore';
import { showSidePane } from '../layout/layoutStore';
import { usePreview } from '../preview/previewStore';
import { useSessions } from '../sessions/sessionsStore';
import { useChats } from './chatStore';

const sockets = new Map<string, ChatSocket>();

/** Routes one server message of a session's socket to the store that shows it. */
export function dispatchMessage(sessionId: string, message: ServerMessage): void {
  const chats = useChats.getState();
  switch (message.type) {
    case 'replay':
      chats.replay(sessionId, message);
      break;
    case 'event':
      chats.event(sessionId, message.event);
      break;
    case 'delta':
      chats.delta(sessionId, message);
      break;
    case 'reset':
      chats.reset(sessionId, message.events);
      break;
    case 'usage':
      chats.setUsage(sessionId, message.usage);
      break;
    case 'busy':
      chats.setBusy(sessionId, message.busy);
      break;
    case 'config':
      chats.setConfig(sessionId, message.config);
      break;
    case 'status':
      useSessions.getState().upsert(message.session);
      break;
    case 'approval-request':
      useApprovals.getState().receive(message.request);
      break;
    case 'preview-open':
      if (usePreview.getState().open(sessionId, message.url)) {
        if (useSessions.getState().activeId === sessionId) showSidePane('preview');
      }
      break;
    case 'preview-browser':
      // The agent is driving the browser: show it doing so.
      if (useSessions.getState().activeId === sessionId) showSidePane('preview');
      break;
    case 'new-tab':
      if (usePreview.getState().openInNewTab(sessionId, message.url)) {
        if (useSessions.getState().activeId === sessionId) showSidePane('preview');
      }
      break;
    case 'pong':
    case 'ack':
      break;
  }
}

/** Keeps a session's chat connected (also while its pane is hidden); returns what ends it. */
export function connectChat(sessionId: string): () => void {
  const socket = openChatSocket(sessionId, {
    onOpen: () => useChats.getState().setOnline(sessionId, true),
    onClose: () => useChats.getState().setOnline(sessionId, false),
    onMessage: (message) => dispatchMessage(sessionId, message),
  });
  sockets.set(sessionId, socket);
  return () => {
    socket.close();
    if (sockets.get(sessionId) === socket) sockets.delete(sessionId);
    useChats.getState().forget(sessionId);
  };
}

export function sendChat(sessionId: string, message: ClientMessage): void {
  sockets.get(sessionId)?.send(message);
}
