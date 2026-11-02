import { parseLocalUrl } from '@deck/shared';
import { invalid } from '../domain/errors.js';
import type { EventBus } from '../domain/events.js';

export interface PreviewTarget {
  setPreview(id: string, url: string): string;
}

/** Agent-facing preview actions; every URL goes through the localhost guard. */
export class PreviewService {
  constructor(
    private readonly sessions: PreviewTarget,
    private readonly bus: EventBus,
  ) {}

  open(sessionId: string, url: string): string {
    const safe = this.sessions.setPreview(sessionId, url);
    this.bus.publish({ kind: 'preview', sessionId, url: safe });
    return safe;
  }

  suggestNewTab(sessionId: string, url: string): string {
    const safe = parseLocalUrl(url);
    if (safe === null) throw invalid('URL must be http(s) on localhost');
    this.bus.publish({ kind: 'new-tab', sessionId, url: safe });
    return safe;
  }
}
