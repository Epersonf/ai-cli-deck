import type { PairResult, PairStart } from '@deck/shared';
import { forbidden, notFound, unavailable } from '../domain/errors.js';
import type { PendingAsk } from '../domain/networkNode.js';
import type { NetworkService } from './NetworkService.js';
import type { PeerBook } from './PeerBook.js';

/** An ask the user never finished is dropped after this long. */
const ASK_TTL_MS = 5 * 60_000;

interface Ask {
  ask: PendingAsk;
  address: string;
  timer: ReturnType<typeof setTimeout>;
}

/** This deck asking another to pair: connect, then try the code the user reads on the other screen. */
export class PairingFlow {
  private readonly asks = new Map<string, Ask>();

  constructor(
    private readonly network: NetworkService<unknown>,
    private readonly book: PeerBook,
    private readonly idOf: (key: Buffer) => string,
    private readonly newId: () => string,
  ) {}

  async start(address: string): Promise<PairStart> {
    const target = this.network.normalize(address);
    const ask = await this.network
      .must()
      .ask(target)
      .catch((error: unknown) => {
        throw unavailable(error instanceof Error ? error.message : 'Cannot reach that deck');
      });
    const pairingId = this.newId();
    const timer = setTimeout(() => this.cancel(pairingId), ASK_TTL_MS);
    timer.unref?.();
    this.asks.set(pairingId, { ask, address: target, timer });
    return { pairingId, name: ask.name };
  }

  async submit(pairingId: string, code: string): Promise<PairResult> {
    const entry = this.asks.get(pairingId);
    if (!entry) throw notFound('Pairing');
    let wrong: { left: number } | null;
    try {
      wrong = await entry.ask.submit(code);
    } catch (error) {
      this.cancel(pairingId);
      throw forbidden(error instanceof Error ? error.message : 'Pairing failed');
    }
    if (wrong) return { peer: null, left: wrong.left };
    this.cancel(pairingId);
    const id = this.idOf(entry.ask.key);
    await this.book.pair({
      id,
      name: entry.ask.name,
      key: entry.ask.key.toString('base64'),
      addresses: [entry.address],
    });
    const peer = this.network.peers().find((p) => p.id === id);
    return { peer: peer ?? null, left: null };
  }

  cancel(pairingId: string): void {
    const entry = this.asks.get(pairingId);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.asks.delete(pairingId);
    entry.ask.close();
  }
}
