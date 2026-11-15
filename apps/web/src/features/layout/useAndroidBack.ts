import { useEffect, useRef } from 'react';

interface BackWindow {
  /** true: handled in the page; false: the APK returns to its log screen. */
  deckBack?: () => boolean;
}

/** Native Back consults the current UI; ordinary browser history is unchanged. */
export function useAndroidBack(handle: () => boolean): void {
  const current = useRef(handle);
  current.current = handle;
  useEffect(() => {
    const target = window as BackWindow;
    const back = (): boolean => current.current();
    target.deckBack = back;
    return () => {
      if (target.deckBack === back) delete target.deckBack;
    };
  }, []);
}
