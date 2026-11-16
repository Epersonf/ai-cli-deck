const ESC = String.fromCharCode(27);
/** Colour and cursor codes (CSI), window titles (OSC) and the odd stray control character. */
const ANSI = new RegExp(
  `${ESC}\\[[0-9;?]*[ -/]*[@-~]|${ESC}\\][^\\u0007${ESC}]*(\\u0007|${ESC}\\\\)|[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f]`,
  'g',
);

/** What a CLI printed, without colours or control codes, and with plain line ends. */
export const cleanOutput = (raw: string): string => raw.replace(ANSI, '').replace(/\r\n?/g, '\n');

const URL_RE = /https?:\/\/[^\s<>"')]+/;

export interface LoginProgress {
  url: string | null;
  code: string | null;
  needsCode: boolean;
}

/**
 * The page to open, the device code and whether the CLI waits for a pasted code, read from what it printed.
 * A URL the terminal wrapped onto the next line is joined back when that line has no spaces.
 */
export function readLoginOutput(raw: string): LoginProgress {
  const text = cleanOutput(raw);
  const lines = text.split('\n');
  let url: string | null = null;
  lines.forEach((line, i) => {
    if (url !== null) return;
    const found = URL_RE.exec(line);
    if (!found) return;
    url = found[0];
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j] ?? '';
      if (!/^[^\s]+$/.test(next) || /^(Paste|If|Opening)/.test(next)) break;
      url += next;
    }
  });
  const code = /\b([A-Z0-9]{4}-[A-Z0-9]{4,6})\b/.exec(text)?.[1] ?? null;
  return {
    url,
    code,
    needsCode:
      /paste code here|(?:enter|paste|authorization)[^\n]{0,40}(?:authorization |auth )?code[^\n]{0,10}[:>]/i.test(
        text,
      ),
  };
}
