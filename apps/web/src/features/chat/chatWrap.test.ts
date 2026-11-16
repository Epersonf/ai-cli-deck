// @vitest-environment jsdom
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderMarkdown } from './renderMarkdown';

const styles = ['base', 'chat', 'chatBlocks']
  .map((name) => readFileSync(resolve(import.meta.dirname, '../../styles', `${name}.css`), 'utf8'))
  .join('\n');
const token = 'long_path_without_spaces_'.repeat(40);
const code = `const value = "${token}";\n  second line`;

// Real layout needs Chromium: npx playwright-core install chromium.
// jsdom cannot measure line wrapping or scroll widths.
describe.skipIf(!existsSync(chromium.executablePath()))('chat wrapping in Chromium', () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await chromium.launch({
      executablePath: chromium.executablePath(),
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--in-process-gpu'],
    });
  }, 30_000);
  afterAll(async () => {
    await browser?.close();
  });

  for (const width of [320, 390, 1280]) {
    it(`wraps messages, code, tables and tool output at ${width}px`, async () => {
      const page = await browser.newPage({ viewport: { width, height: 800 } });
      try {
        const markdown = renderMarkdown(
          [
            `[${token}](https://example.com/${token})`,
            `\`${token}\``,
            `\`\`\`ts\n${code}\n\`\`\``,
            `| Path | Value |\n| --- | --- |\n| ${token} | ${token} |`,
            '<img src="missing.png" width="2400" height="600" alt="image">',
          ].join('\n\n'),
        );
        await page.setContent(`<style>${styles}</style>
          <div class="chat-pane" style="display:flex;flex-direction:column;height:800px">
            <div class="chat-scroll-wrap"><div class="chat-scroll"><div class="chat-column">
              <div class="msg user"><div class="bubble"><p class="user-text">${token}</p></div></div>
              <div class="msg assistant"><div class="md">${markdown}</div></div>
              <details class="msg thinking" open><summary>Thinking</summary><p>${token}</p></details>
              <p class="notice-row">${token}</p>
              <div class="tool-card"><div class="tool-body"><pre class="tool-pre">${code}</pre>
                <div class="tool-diff"><pre class="add">${code}</pre></div>
              </div></div>
            </div></div></div>
          </div>`);
        const overflowing = await page.evaluate(() =>
          [
            ...document.querySelectorAll<HTMLElement>(
              'body, .chat-pane, .chat-scroll-wrap, .chat-scroll, .chat-column, .chat-column *, pre',
            ),
          ]
            .filter((element) => element.scrollWidth > element.clientWidth + 1)
            .map(
              (element) =>
                `${element.tagName}.${element.className}: ${element.scrollWidth}/${element.clientWidth}; wrap=${getComputedStyle(element).overflowWrap}; white=${getComputedStyle(element).whiteSpace}`,
            ),
        );
        expect(overflowing).toEqual([]);
        const pre = page.locator('.md pre');
        expect(await pre.textContent()).toBe(code);
        expect(await pre.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe(
          'pre-wrap',
        );
        expect(
          await pre.evaluate((element) => element.getBoundingClientRect().height),
        ).toBeGreaterThan(60);
      } finally {
        await page.close();
      }
    });
  }
});
