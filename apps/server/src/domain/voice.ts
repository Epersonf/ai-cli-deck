export interface VoiceStatus {
  /** This machine can transcribe speech (with the engine the deck downloads, or one already installed). */
  supported: boolean;
  /** The engine and the model are in place: `transcribe` works. */
  ready: boolean;
  downloading: boolean;
  /** How much of the download is done, 0..100. */
  progress: number;
  /** Why the last download failed, or null. */
  error: string | null;
  /** What to do when `supported` is false. */
  hint: string | null;
}

/** Speech to text, on this machine. */
export interface VoicePort {
  status(): VoiceStatus;
  /** Starts downloading the engine and the model (once); the progress is in `status`. */
  prepare(): VoiceStatus;
  /** Text of a 16 kHz mono PCM16 WAV recording; `lang` is a language code such as `pt` or `en`. */
  transcribe(wav: Buffer, lang: string): Promise<string>;
}
