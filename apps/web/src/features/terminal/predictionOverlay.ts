import type { Terminal } from '@xterm/xterm';
import type { PredictionView, ScreenView } from './predictor';
import { TERMINAL_THEME } from './theme';

/** The real terminal seen through the predictor's eyes. */
export function screenOf(term: Terminal): ScreenView {
  return {
    get cols() {
      return term.cols;
    },
    cursor: () => ({ x: term.buffer.active.cursorX, y: term.buffer.active.cursorY }),
    cell(x, y) {
      const buffer = term.buffer.active;
      return (
        buffer
          .getLine(buffer.baseY + y)
          ?.getCell(x)
          ?.getChars() || ' '
      );
    },
    alternate: () => term.buffer.active.type === 'alternate',
    atBottom: () => term.buffer.active.viewportY === term.buffer.active.baseY,
  };
}

/**
 * Draws predicted characters above the terminal canvas. It is a separate layer, so nothing
 * is ever written to the terminal buffer and a wrong guess simply disappears.
 */
export function createOverlay(term: Terminal) {
  const layer = document.createElement('div');
  layer.className = 'prediction-layer';
  layer.setAttribute('aria-hidden', 'true');
  const host = (): HTMLElement | null => term.element?.querySelector('.xterm-screen') ?? null;

  return {
    render(view: PredictionView | null): void {
      const screen = host();
      if (!screen) return;
      if (layer.parentElement !== screen) screen.appendChild(layer);
      layer.replaceChildren();
      if (view === null) return;
      const cw = screen.clientWidth / term.cols;
      const ch = screen.clientHeight / term.rows;
      if (!(cw > 0 && ch > 0)) return;
      const font = {
        fontFamily: String(term.options.fontFamily),
        fontSize: `${term.options.fontSize}px`,
        lineHeight: `${ch}px`,
      };
      const place = (x: number, y: number): HTMLSpanElement => {
        const cell = document.createElement('span');
        Object.assign(cell.style, font, {
          left: `${x * cw}px`,
          top: `${y * ch}px`,
          width: `${cw}px`,
          height: `${ch}px`,
        });
        layer.appendChild(cell);
        return cell;
      };
      for (const p of view.chars) {
        const cell = place(p.x, p.y);
        cell.textContent = p.ch;
        if (p.erase) cell.style.background = TERMINAL_THEME.background ?? '#000';
      }
      const cursor = place(view.cursor.x, view.cursor.y);
      cursor.className = 'prediction-cursor';
      cursor.style.background = TERMINAL_THEME.cursor ?? '#ffb43a';
    },
    clear(): void {
      layer.replaceChildren();
    },
  };
}
