import { usePreview, previewable } from '../preview/previewStore';
import { showSidePane } from '../layout/layoutStore';

export function openLink(sessionId: string, uri: string): void {
  if (previewable(uri, window.location.origin) !== null) {
    usePreview.getState().open(sessionId, uri);
    showSidePane('preview');
  } else {
    window.open(uri, '_blank', 'noopener,noreferrer');
  }
}
