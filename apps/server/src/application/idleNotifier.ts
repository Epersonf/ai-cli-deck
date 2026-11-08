import type { PhonePort } from '../domain/ports.js';
import { screenTail } from './screenTail.js';

const decoder = new TextDecoder();

/** What a quiet terminal sends to the phone: the message plus the last lines on its screen, so it says what the agent said. */
export function idleNotifier(
  phone: PhonePort,
  replay: (sessionId: string) => Promise<Uint8Array>,
  sessionId: string,
): (text: string) => Promise<void> {
  return async (text) => {
    const tail = await replay(sessionId)
      .then((screen) => screenTail(decoder.decode(screen)))
      .catch(() => '');
    await phone.request('POST', '/notify', {
      title: 'CLI Deck',
      text: tail ? `${text}\n${tail}` : text,
    });
  };
}
