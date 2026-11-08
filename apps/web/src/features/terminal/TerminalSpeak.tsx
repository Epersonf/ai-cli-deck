import { useState, type MutableRefObject } from 'react';
import { useT } from '../../shared/i18n/store';
import { SpeakerIcon, StopIcon } from '../../shared/ui/ToolIcons';
import { canSpeak, speak, speakable, stopSpeaking } from './speakText';
import type { TerminalApi } from './terminalApi';

/** Reads the end of the screen aloud with the phone's own voice (nothing is installed or sent anywhere). */
export function TerminalSpeak({ api }: { api: MutableRefObject<TerminalApi | null> }) {
  const t = useT();
  const [unsupported, setUnsupported] = useState(!canSpeak());
  const start = (): void => {
    if (!canSpeak()) return setUnsupported(true);
    speak(speakable(api.current?.text('screen') ?? ''), document.documentElement.lang || 'en');
  };
  return (
    <div className="tools-actions">
      <button type="button" className="tool-action primary" onClick={start}>
        <SpeakerIcon size={24} />
        <span>{t('tools.speakScreen')}</span>
      </button>
      <button type="button" className="tool-action" onClick={stopSpeaking}>
        <StopIcon size={24} />
        <span>{t('tools.speakStop')}</span>
      </button>
      {unsupported && <span className="tools-note">{t('tools.speakNone')}</span>}
    </div>
  );
}
