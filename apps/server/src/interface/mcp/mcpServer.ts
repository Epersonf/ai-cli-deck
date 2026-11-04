import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DeckError } from '../../domain/errors.js';
import type { AgentTools } from '../agent/agentTools.js';
import { run, runAsync } from './mcpResult.js';

/** One MCP server per request, bound to the calling session. No tool runs git or writes files. */
export function buildMcpServer(tools: AgentTools): McpServer {
  const server = new McpServer({ name: 'ai-cli-deck', version: '0.1.0' });

  server.registerTool(
    'list_sessions',
    { description: 'List the other sessions open in the deck (provider, folder, status).' },
    () => run(tools.listSessions),
  );
  server.registerTool(
    'session_title',
    {
      description:
        'Name this terminal in the deck (3-6 words, about the task). Omit title to just read the current name. Call it once the topic is clear and again only if it changes.',
      inputSchema: { title: z.string().max(200).optional() },
    },
    ({ title }) => runAsync(() => tools.title(title)),
  );
  server.registerTool(
    'session_meta',
    {
      description:
        'Notes kept with this session. Save how to resume this chat: key "resume", value = the arguments for your CLI (e.g. "--resume <chat id>"). Ids only, never content. No args: read all; key only: read; key+value: save (empty value removes).',
      inputSchema: { key: z.string().min(1).optional(), value: z.string().optional() },
    },
    ({ key, value }) => runAsync(() => tools.meta(key, value)),
  );
  server.registerTool(
    'propose_worktree',
    {
      description:
        'Ask the user to create a git worktree for this session. Nothing is created until the user approves. Poll get_request_status.',
      inputSchema: { reason: z.string().min(1).describe('Why a separate worktree is needed') },
    },
    ({ reason }) => run(() => tools.proposeWorktree(reason)),
  );
  server.registerTool(
    'open_preview',
    {
      description: "Open a localhost URL in this session's preview panel.",
      inputSchema: {
        url: z.string().min(1).describe('http(s)://localhost:PORT/... or just a port'),
      },
    },
    ({ url }) => run(() => tools.openPreview(url)),
  );
  server.registerTool(
    'suggest_new_tab',
    {
      description: 'Show the user a button that opens a localhost URL in a new browser tab.',
      inputSchema: { url: z.string().min(1) },
    },
    ({ url }) => run(() => tools.suggestNewTab(url)),
  );
  server.registerTool(
    'get_request_status',
    {
      description:
        'Status of an approval request: pending, approved (with the new path) or rejected.',
      inputSchema: { requestId: z.string().min(1) },
    },
    ({ requestId }) => run(() => tools.requestStatus(requestId)),
  );

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
    { description: 'Accessibility outline (text) of the current page: read this to see the page.' },
    () => runAsync(() => tools.browserOutline()),
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
  return server;
}
