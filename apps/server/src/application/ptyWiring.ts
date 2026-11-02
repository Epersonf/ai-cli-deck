import type { EventBus } from '../domain/events.js';
import type { PtyHandle } from '../domain/ports.js';
import type { RingBuffer } from './RingBuffer.js';

/** Streams pty output into the replay buffer and the event bus, and reports the exit once. */
export function wirePty(
  pty: PtyHandle,
  ring: RingBuffer,
  sessionId: string,
  bus: EventBus,
  onExit: () => void,
  onOutput: () => void = () => undefined,
): void {
  pty.onData((data) => {
    ring.push(data);
    onOutput();
    bus.publish({ kind: 'output', sessionId, data });
  });
  pty.onExit((code) => {
    onExit();
    bus.publish({ kind: 'exit', sessionId, code });
  });
}
