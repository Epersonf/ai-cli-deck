/** Terminal text made fit to be spoken: no box drawing or symbols, only lines with words, the end of the screen. */
export function speakable(screen: string, max = 1200): string {
  const lines = screen
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/[^\p{L}\p{N}\p{P}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((line) => /[\p{L}\p{N}]/u.test(line));
  return lines.join('. ').slice(-max);
}

export const canSpeak = (): boolean =>
  typeof window !== 'undefined' &&
  'speechSynthesis' in window &&
  'SpeechSynthesisUtterance' in window;

export function speak(text: string, lang: string): void {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
}

export const stopSpeaking = (): void => {
  if (canSpeak()) window.speechSynthesis.cancel();
};
