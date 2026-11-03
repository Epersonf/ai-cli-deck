import { useEffect, useState } from 'react';
import { browserShotUrl } from '../../shared/api/endpoints';

const FRAME_MS = 1000;

/**
 * Keeps the newest screenshot of the session's browser while the pane is visible. A frame is
 * preloaded first so the picture never flashes empty between updates.
 */
export function useBrowserFrames(sessionId: string, visible: boolean, onTick: () => void) {
  const [frame, setFrame] = useState<string | null>(null);
  useEffect(() => {
    if (!visible) return;
    let stopped = false;
    let tick = 0;
    const loop = (): void => {
      const next = new Image();
      const src = browserShotUrl(sessionId, Date.now());
      next.onload = () => !stopped && setFrame(src);
      next.src = src;
      if (tick++ % 3 === 0) onTick();
    };
    loop();
    const timer = setInterval(loop, FRAME_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [sessionId, visible, onTick]);
  return frame;
}
