import { api } from '../../shared/api/endpoints';
import { browserNumbers, type PreviewTabs } from './previewTabs';

/** Tells the deck which browser tabs a session has now, when this change touched them (every device follows). */
export function shareBrowserTabs(sessionId: string, before: PreviewTabs, after: PreviewTabs): void {
  const next = browserNumbers(after);
  if (browserNumbers(before).join() === next.join()) return;
  void api.setBrowserTabs(sessionId, next).catch(() => undefined);
}
