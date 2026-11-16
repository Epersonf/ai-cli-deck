import type { LoginChild } from '../domain/signin.js';

export class FakeChild implements LoginChild {
  data: Array<(t: string) => void> = [];
  exit: Array<(c: number | null) => void> = [];
  written: string[] = [];
  killed = false;
  onData(l: (t: string) => void) {
    this.data.push(l);
  }
  onExit(l: (c: number | null) => void) {
    this.exit.push(l);
  }
  write(t: string) {
    this.written.push(t);
  }
  kill() {
    this.killed = true;
  }
  say(t: string) {
    this.data.forEach((l) => l(t));
  }
  end(c: number | null) {
    this.exit.forEach((l) => l(c));
  }
}
