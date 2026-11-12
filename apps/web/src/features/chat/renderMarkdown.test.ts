// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './renderMarkdown';

describe('renderMarkdown', () => {
  it('renders basic markdown', () => {
    const html = renderMarkdown('# Title\n\n**bold** and `code`\n\n- one\n- two');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<li>one</li>');
  });

  it('drops scripts, event handlers and javascript links', () => {
    const html = renderMarkdown(
      '<script>alert(1)</script><img src=x onerror="alert(1)">[x](javascript:alert(1))',
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).not.toMatch(/href=.javascript/i);
  });

  it('opens links in a new tab without handing over the opener', () => {
    const html = renderMarkdown('[site](https://example.com)');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('noopener');
  });

  it('wraps code in a block with a labelled copy button and escapes it', () => {
    const html = renderMarkdown('```ts\nconst a = "<b>";\n```', 'Copy code');
    expect(html).toContain('class="md-code"');
    expect(html).toContain('aria-label="Copy code"');
    expect(html).toContain('language-ts');
    expect(html).not.toContain('<b>');
  });
});
