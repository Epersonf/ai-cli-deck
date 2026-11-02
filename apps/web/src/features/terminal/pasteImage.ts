import type { Terminal } from '@xterm/xterm';
import { api } from '../../shared/api/endpoints';

/**
 * A screenshot on the clipboard lives in the browser, not on the machine running the CLI: upload
 * it and type its path, which the agent CLIs read as an image attachment. Returns the detacher.
 */
export function attachImagePaste(
  element: HTMLElement,
  term: Terminal,
  sessionId: string,
): () => void {
  const onPaste = (event: ClipboardEvent): void => {
    const image = [...(event.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
    if (!image) return;
    event.preventDefault();
    event.stopPropagation();
    void api
      .paste(sessionId, image)
      .then(({ path }) => term.paste(`${path} `))
      .catch((e: unknown) =>
        term.write(
          `\r\n\x1b[31m[paste failed: ${e instanceof Error ? e.message : 'error'}]\x1b[0m\r\n`,
        ),
      );
  };
  element.addEventListener('paste', onPaste, true);
  return () => element.removeEventListener('paste', onPaste, true);
}
