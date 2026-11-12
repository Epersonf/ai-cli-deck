import { useEffect, useState } from 'react';
import { LOCALES } from '../../shared/i18n/locales';
import { useLocale, useT } from '../../shared/i18n/store';
import { useRecorder } from '../voice/useRecorder';
import { voiceApi } from '../voice/voiceApi';
import { useVoice } from '../voice/voiceStore';
import { MicIcon } from '../../shared/ui/GlyphIcons';
import { StopIcon } from '../../shared/ui/ToolIcons';

const recordable = (): boolean =>
  typeof MediaRecorder !== 'undefined' && navigator.mediaDevices?.getUserMedia !== undefined;

/**
 * The microphone: press to talk, press again to send it to the speech model on the deck. The first time
 * the model must be downloaded (one button, with progress); where the deck cannot transcribe, no button.
 */
export function MicButton({ onText }: { onText(text: string): void }) {
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const { status, refresh, prepare } = useVoice();
  const { state, start, stop } = useRecorder();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === null) void refresh();
  }, [status, refresh]);

  if (!status?.supported || !recordable()) return null;
  if (!status.ready) {
    return (
      <button
        type="button"
        className={`tool mic setup${status.downloading ? ' downloading' : ''}`}
        disabled={status.downloading}
        aria-label={status.downloading ? t('voice.downloading') : t('voice.prepare')}
        title={`${status.downloading ? t('voice.downloading') : t('voice.prepare')} — ${t('voice.prepareHint')}`}
        onClick={() => void prepare().catch((e: unknown) => setError(String(e)))}
      >
        {status.downloading ? '…' : <MicIcon size={20} />}
      </button>
    );
  }

  const toggle = async (): Promise<void> => {
    setError(null);
    try {
      if (state === 'idle') return await start();
      const wav = await stop();
      if (!wav) return;
      const lang = LOCALES.find((l) => l.code === locale)?.code ?? 'en';
      const text = (await voiceApi.transcribe(wav, lang)).trim();
      if (text !== '') onText(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    }
  };
  const label = state === 'recording' ? t('voice.stop') : t('voice.talk');
  return (
    <button
      type="button"
      className={`tool mic${state === 'recording' ? ' recording' : ''}`}
      aria-label={label}
      title={error ?? label}
      disabled={state === 'working'}
      onClick={() => void toggle()}
    >
      {state === 'working' ? (
        '…'
      ) : state === 'recording' ? (
        <StopIcon size={20} />
      ) : (
        <MicIcon size={20} />
      )}
    </button>
  );
}
