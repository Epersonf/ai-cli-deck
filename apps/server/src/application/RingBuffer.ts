/** Keeps the most recent bytes of terminal output for replay on reconnect. */
export class RingBuffer {
  private chunks: Uint8Array[] = [];
  private size = 0;

  constructor(private readonly maxBytes: number) {}

  push(chunk: Uint8Array): void {
    this.chunks.push(chunk);
    this.size += chunk.byteLength;
    while (this.size > this.maxBytes && this.chunks.length > 1) {
      const dropped = this.chunks.shift();
      this.size -= dropped?.byteLength ?? 0;
    }
  }

  snapshot(): Uint8Array {
    return Buffer.concat(this.chunks);
  }
}
