import type { ServerMessage } from '@deck/shared';
import { useApprovals } from '../approvals/approvalsStore';
import { usePreview } from '../preview/previewStore';
import { useSessions } from '../sessions/sessionsStore';

export const decodeBase64 = (data: string): Uint8Array =>
  Uint8Array.from(atob(data), (char) => char.charCodeAt(0));

export interface TerminalSink {
  write(bytes: Uint8Array): void;
  reset(): void;
  note(text: string): void;
}

/** Routes one server message to the terminal or to the matching feature store. */
export function dispatchMessage(
  sessionId: string,
  message: ServerMessage,
  sink: TerminalSink,
): void {
  switch (message.type) {
    case 'output':
      sink.write(decodeBase64(message.data));
      break;
    case 'status':
      useSessions.getState().upsert(message.session);
      break;
    case 'exit':
      sink.note(`process exited${message.code === null ? '' : ` (code ${message.code})`}`);
      break;
    case 'approval-request':
      useApprovals.getState().receive(message.request);
      break;
    case 'preview-open':
      if (usePreview.getState().open(sessionId, message.url)) {
        if (useSessions.getState().activeId === sessionId)
          useSessions.getState().setView('preview');
      }
      break;
    case 'new-tab':
      usePreview.getState().suggestNewTab(sessionId, message.url);
      break;
    case 'pong':
      break;
  }
}
