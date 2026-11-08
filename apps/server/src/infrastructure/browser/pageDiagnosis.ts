import type { Page } from 'playwright-core';

const KEEP = 20;

/** What a page's own console and network said when something went wrong, newest last. */
export function collectProblems(page: Page): string[] {
  const problems: string[] = [];
  const note = (text: string): void => {
    problems.push(text.slice(0, 200));
    if (problems.length > KEEP) problems.shift();
  };
  page.on('pageerror', (error) => note(`error: ${String(error)}`));
  page.on('console', (message) => {
    if (message.type() === 'error') note(`console: ${message.text()}`);
  });
  page.on('requestfailed', (request) =>
    note(`request failed: ${request.url()} ${request.failure()?.errorText ?? ''}`),
  );
  return problems;
}

/** Runs inside the page. */
const GRAPHICS = `(() => {
  const probe = document.createElement('canvas');
  const gl = probe.getContext('webgl2') || probe.getContext('webgl');
  let webgl = 'none';
  if (gl) {
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    webgl = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.VERSION));
  }
  return {
    webgl,
    visibility: document.visibilityState,
    canvases: [...document.querySelectorAll('canvas')].map((c) => c.width + 'x' + c.height),
  };
})()`;

/** Whether the page can draw with WebGL here, and how its canvases look: the usual reason for a blank game. */
export function inspectGraphics(
  page: Page,
): Promise<{ webgl: string; visibility: string; canvases: string[] }> {
  return page.evaluate(GRAPHICS);
}
