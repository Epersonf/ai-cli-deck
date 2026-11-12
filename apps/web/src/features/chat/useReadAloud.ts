import { useEffect, useRef } from 'react';
import { useLocale } from '../../shared/i18n/store';
import { LOCALES } from '../../shared/i18n/locales';
import { useVoice } from '../voice/voiceStore';
import type { Block } from './blocks';
import { canSpeak, speak, speakable, stopSpeaking } from './speech';

/** While read-aloud is on, speaks each answer as it is finished (never what was already there on load). */
export function useReadAloud(blocks: readonly Block[], loaded: boolean, active: boolean): void {
  const on = useVoice((s) => s.speak);
  const locale = useLocale((s) => s.locale);
  const spoken = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!loaded) return;
    const texts = blocks.filter((b) => b.kind === 'text' && !b.streaming);
    if (spoken.current === null) {
      spoken.current = new Set(texts.map((b) => b.id)); // what was there when the chat opened
      return;
    }
    for (const block of texts) {
      if (spoken.current.has(block.id)) continue;
      spoken.current.add(block.id);
      if (on && active && block.kind === 'text' && canSpeak()) {
        speak(speakable(block.text), LOCALES.find((l) => l.code === locale)?.html ?? 'en');
      }
    }
  }, [blocks, loaded, on, active, locale]);

  useEffect(() => {
    if (!on) stopSpeaking();
  }, [on]);
}
