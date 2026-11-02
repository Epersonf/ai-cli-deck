import { useCallback, useRef, useState } from 'react';
import { NO_MODS, type Modifiers } from './keymap';
import { OFF, consume, isActive, tap, type StickyModifier } from './stickyModifier';

export interface ModifiersApi {
  ctrl: StickyModifier;
  alt: StickyModifier;
  tap(which: 'ctrl' | 'alt'): void;
  /** Reads the active modifiers for the next key and releases the armed ones. */
  take(): Modifiers;
}

export function useModifiers(): ModifiersApi {
  const [ctrl, setCtrl] = useState<StickyModifier>(OFF);
  const [alt, setAlt] = useState<StickyModifier>(OFF);
  const latest = useRef({ ctrl, alt });
  latest.current = { ctrl, alt };

  const tapKey = useCallback((which: 'ctrl' | 'alt') => {
    const next = tap(latest.current[which], Date.now());
    latest.current = { ...latest.current, [which]: next };
    (which === 'ctrl' ? setCtrl : setAlt)(next);
  }, []);

  const take = useCallback((): Modifiers => {
    const { ctrl: c, alt: a } = latest.current;
    if (!isActive(c) && !isActive(a)) return NO_MODS;
    latest.current = { ctrl: consume(c), alt: consume(a) };
    setCtrl(latest.current.ctrl);
    setAlt(latest.current.alt);
    return { ctrl: isActive(c), alt: isActive(a) };
  }, []);

  return { ctrl, alt, tap: tapKey, take };
}
