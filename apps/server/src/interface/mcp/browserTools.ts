import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DeckError } from '../../domain/errors.js';
import type { AgentTools } from '../agent/agentTools.js';
import { pageText } from './pagination.js';
import { runAsync } from './mcpResult.js';

/** The tools that drive the deck's Chromium (shown to the user in the Preview pane). */
export function registerBrowserTools(server: McpServer, tools: AgentTools, pageSize = 16000): void {
  const target = z
    .string()
    .min(1)
    .describe('Playwright selector: CSS, or text=Sign in, role=button[name="Save"], etc.');
  server.registerTool(
    'browser_navigate',
    {
      description:
        "Open an http(s) address in the deck's real Chromium (shown to the user in the Preview pane). Works for localhost and the internet.",
      inputSchema: { url: z.string().min(1).describe('URL, host or just a port') },
    },
    ({ url }) => runAsync(() => tools.browserNavigate(url)),
  );
  server.registerTool(
    'browser_snapshot',
    {
      description: `Accessibility outline, up to ${pageSize} characters by default. Continue with nextOffset to read more of the same page.`,
      inputSchema: {
        offset: z.number().int().nonnegative().optional(),
        limit: z.number().int().min(2).max(40000).optional(),
      },
    },
    ({ offset, limit }) =>
      runAsync(async () => {
        const { outline, ...info } = await tools.browserOutline();
        const page = pageText(outline, offset ?? 0, limit ?? pageSize);
        return {
          ...info,
          outline: page.text,
          offset: page.offset,
          total: page.total,
          nextOffset: page.nextOffset,
        };
      }),
  );
  server.registerTool(
    'browser_screenshot',
    { description: 'Screenshot (JPEG) of the current page.' },
    async () => {
      try {
        const image = await tools.browserScreenshot();
        return {
          content: [
            { type: 'image' as const, data: image.toString('base64'), mimeType: 'image/jpeg' },
          ],
        };
      } catch (error) {
        if (!(error instanceof DeckError)) throw error;
        return { content: [{ type: 'text' as const, text: error.message }], isError: true };
      }
    },
  );
  server.registerTool(
    'browser_click',
    { description: 'Click an element of the current page.', inputSchema: { target } },
    ({ target: t }) => runAsync(() => tools.browserClick(t)),
  );
  server.registerTool(
    'browser_fill',
    {
      description: 'Replace the text of an input/textarea.',
      inputSchema: { target, text: z.string().max(10000) },
    },
    ({ target: t, text }) => runAsync(() => tools.browserFill(t, text)),
  );
  server.registerTool(
    'browser_type',
    {
      description: 'Type text into the focused element.',
      inputSchema: { text: z.string().min(1).max(2000) },
    },
    ({ text }) => runAsync(() => tools.browserType(text)),
  );
  server.registerTool(
    'browser_press',
    {
      description: 'Press a key, e.g. Enter, Tab, Escape, ArrowDown, Control+A.',
      inputSchema: { key: z.string().min(1).max(40) },
    },
    ({ key }) => runAsync(() => tools.browserPress(key)),
  );
  server.registerTool(
    'browser_scroll',
    {
      description: 'Scroll the page vertically by pixels (positive = down).',
      inputSchema: { dy: z.number().min(-5000).max(5000) },
    },
    ({ dy }) => runAsync(() => tools.browserScroll(dy)),
  );
}
