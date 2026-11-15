import { useEffect, useRef } from 'react';

interface BackWindow {
  /** true: handled in the page; false: the APK returns to its log screen. */
  deckBack?: () => boolean;
}

const handlers = new Map<symbol, { priority: number; handle(): boolean }>();
const dispatchBack = (): boolean => {
  const first = [...handlers.values()].sort((a, b) => b.priority - a.priority)[0];
  return first?.handle() ?? false;
};

/** The topmost UI owns Back, including its decision to return to native logs. */
export function useAndroidBack(handle: () => boolean, priority = 0): void {
  const current = useRef(handle);
  current.current = handle;
  useEffect(() => {
    const target = window as BackWindow;
    const id = Symbol('back');
    handlers.set(id, { priority, handle: () => current.current() });
    target.deckBack = dispatchBack;
    return () => {
      handlers.delete(id);
      if (handlers.size === 0 && target.deckBack === dispatchBack) delete target.deckBack;
    };
  }, [priority]);
}
