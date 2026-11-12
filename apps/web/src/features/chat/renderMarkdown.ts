import DOMPurify from 'dompurify';
import { Marked } from 'marked';

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const marked = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    // Fenced code gets a copy button; the button's text comes from the page, so it stays translated.
    code({ text, lang }) {
      const language = (lang ?? '').split(/\s/)[0] ?? '';
      const cls = /^[\w+-]{1,20}$/.test(language) ? ` class="language-${language}"` : '';
      return `<div class="md-code"><button type="button" class="md-copy" data-copy></button><pre><code${cls}>${escapeHtml(text)}</code></pre></div>`;
    },
  },
});

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/** Markdown from the agent as HTML that is safe to put in the page (scripts, handlers and styles are dropped). */
export function renderMarkdown(text: string, copyLabel = 'Copy'): string {
  const html = marked.parse(text, { async: false });
  const clean = DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'data-copy'],
    FORBID_TAGS: ['style', 'form', 'input', 'textarea', 'select'],
    FORBID_ATTR: ['style'],
  });
  return clean.replaceAll(
    'data-copy=""',
    `data-copy="" aria-label="${escapeHtml(copyLabel)}" title="${escapeHtml(copyLabel)}"`,
  );
}
