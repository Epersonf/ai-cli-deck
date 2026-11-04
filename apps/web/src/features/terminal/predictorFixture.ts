import { createPredictor, type ScreenView } from './predictor';

/** A tiny terminal that echoes on demand. */
export function fakeScreen() {
  const cells = new Map<string, string>();
  /** Faint cells: an input's placeholder. */
  const faint = new Set<string>();
  const state = { x: 0, y: 0, alt: false, bottom: true };
  const screen: ScreenView = {
    cols: 20,
    cursor: () => ({ x: state.x, y: state.y }),
    cell: (x, y) => cells.get(`${x},${y}`) ?? ' ',
    faint: (x, y) => faint.has(`${x},${y}`),
    alternate: () => state.alt,
    atBottom: () => state.bottom,
  };
  /** The program draws a typed character; like a chat box, it drops its placeholder first. */
  const echo = (ch: string): void => {
    for (const key of [...faint]) {
      if (!key.endsWith(`,${state.y}`)) continue;
      faint.delete(key);
      cells.delete(key);
    }
    cells.set(`${state.x},${state.y}`, ch);
    state.x += 1;
  };
  /** Faint text from the cursor on, with the cursor left in front of it (an empty input). */
  const placeholder = (text: string): void => {
    [...text].forEach((ch, i) => {
      cells.set(`${state.x + i},${state.y}`, ch);
      faint.add(`${state.x + i},${state.y}`);
    });
  };
  /** Output the user did not type (prompt text). */
  const write = (ch: string): void => echo(ch);
  /** The server's answer to a backspace: "\b \b". */
  const erase = (): void => {
    state.x -= 1;
    cells.set(`${state.x},${state.y}`, ' ');
  };
  /** A character drawn somewhere without moving the cursor (a program redrawing a row). */
  const draw = (x: number, y: number, ch: string): void => void cells.set(`${x},${y}`, ch);
  return { screen, state, echo, write, erase, placeholder, draw };
}

export function setup(latency: number | null = 100) {
  const fake = fakeScreen();
  let now = 0;
  const predictor = createPredictor({
    screen: fake.screen,
    latency: () => latency,
    clock: () => now,
  });
  return { ...fake, predictor, advance: (ms: number) => (now += ms) };
}

/** Types one char and lets the server echo it, as on a link that works. */
export function typeAndEcho(t: ReturnType<typeof setup>, ch: string): void {
  t.predictor.input(ch);
  t.echo(ch);
  t.predictor.afterWrite();
}
