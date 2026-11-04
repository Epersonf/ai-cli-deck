import { SECRET_PROMPT, type ScreenView } from './predictorTypes';

/** The screen read the way the predictor needs it. */
export function readScreen(screen: ScreenView) {
  const rowText = (y: number): string => {
    let text = '';
    for (let x = 0; x < screen.cols; x += 1) text += screen.cell(x, y) || ' ';
    return text;
  };
  return {
    rowText,
    /** Empty, or showing an input's faint placeholder (typing replaces it). */
    blank: (x: number, y: number): boolean =>
      (screen.cell(x, y) || ' ') === ' ' || screen.faint(x, y),
    /** The text before (x, y) asks for a password: never guess there. */
    secretPrompt: (x: number, y: number): boolean => SECRET_PROMPT.test(rowText(y).slice(0, x)),
  };
}
