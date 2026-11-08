import type { ServerMessage } from '@deck/shared';
import { translateNow } from '../../shared/i18n/store';
import { useApprovals } from '../approvals/approvalsStore';
import { showSidePane } from '../layout/layoutStore';
import { usePreview } from '../preview/previewStore';
import { useSessions } from '../sessions/sessionsStore';

export interface TerminalSink {
  note(text: string): void;
}

/** Routes one server message (terminal output comes separately, as binary frames) to its feature. */
export function dispatchMessage(
  sessionId: string,
  message: ServerMessage,
  sink: TerminalSink,
): void {
  switch (message.type) {
    case 'status':
      useSessions.getState().upsert(message.session);
      break;
    case 'exit':
      sink.note(
        message.code === null
          ? translateNow('terminal.exited')
          : translateNow('terminal.exitedCode', { code: message.code }),
      );
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
      // The agent is driving the browser: show it doing so (without changing this device's default).
      usePreview.getState().setMode(sessionId, 'browser', false);
      if (useSessions.getState().activeId === sessionId) showSidePane('preview');
      break;
    case 'new-tab':
      usePreview.getState().suggestNewTab(sessionId, message.url);
      break;
    case 'pong':
    case 'ack':
      break;
  }
}
