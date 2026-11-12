import { useCallback, useRef, useState } from 'react';
import { recordingToWav } from './wav';

export type RecorderState = 'idle' | 'recording' | 'working';

/** Records the microphone; `stop` gives back the 16 kHz mono WAV (null when nothing was heard). */
export function useRecorder() {
  const [state, setState] = useState<RecorderState>('idle');
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const finish = useRef<((wav: Blob | null) => void) | null>(null);

  const start = useCallback(async (): Promise<void> => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    chunks.current = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
    rec.onstop = () => {
      for (const track of stream.getTracks()) track.stop();
      setState('working');
      const blob = new Blob(chunks.current, { type: rec.mimeType });
      (blob.size > 0 ? recordingToWav(blob) : Promise.resolve(null))
        .catch(() => null)
        .then((wav) => {
          setState('idle');
          finish.current?.(wav);
        });
    };
    recorder.current = rec;
    rec.start();
    setState('recording');
  }, []);

  const stop = useCallback(
    (): Promise<Blob | null> =>
      new Promise((resolve) => {
        finish.current = resolve;
        if (recorder.current?.state === 'recording') recorder.current.stop();
        else resolve(null);
      }),
    [],
  );

  return { state, start, stop };
}
