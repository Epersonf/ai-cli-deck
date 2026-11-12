import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';

const NEAR_PX = 80;

/**
 * Keeps a scroll box at its end while the person has not scrolled away, and tells when they have
 * (so the pane can offer "jump to latest"). `watch` changes whenever the content does.
 */
export function useStickToBottom(box: RefObject<HTMLElement | null>, watch: unknown) {
  const stuck = useRef(true);
  const [away, setAway] = useState(false);

  const onScroll = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_PX;
    stuck.current = near;
    setAway(!near);
  }, [box]);

  useLayoutEffect(() => {
    const el = box.current;
    if (el && stuck.current) el.scrollTop = el.scrollHeight;
  }, [box, watch]);

  const jump = useCallback(() => {
    const el = box.current;
    if (!el) return;
    stuck.current = true;
    setAway(false);
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [box]);

  return { onScroll, away, jump };
}
