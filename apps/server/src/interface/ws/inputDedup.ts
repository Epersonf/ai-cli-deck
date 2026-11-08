const KEEP = 500;
const lastSeen = new Map<string, number>();

/**
 * True the first time input number `seq` of a device is seen. A device resends what it never got an ack
 * for, so the same keys can arrive twice; they must reach the terminal once.
 */
export function acceptInput(key: string, seq: number): boolean {
  const last = lastSeen.get(key);
  if (last !== undefined && seq <= last) return false;
  lastSeen.delete(key); // re-inserted below: the map stays ordered by recent use
  lastSeen.set(key, seq);
  if (lastSeen.size > KEEP) {
    const oldest = lastSeen.keys().next();
    if (!oldest.done) lastSeen.delete(oldest.value);
  }
  return true;
}
