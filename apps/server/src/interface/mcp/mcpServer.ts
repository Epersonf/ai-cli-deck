import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AgentTools } from '../agent/agentTools.js';
import { registerBrowserTools } from './browserTools.js';
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
    'session_handoff',
    {
      description:
        'Write the handoff notes for whoever continues this chat (done, what is left, decisions, key files). Only when the deck asks you to. No text: check whether one exists.',
      inputSchema: { text: z.string().max(8000).optional() },
    },
    ({ text }) => runAsync(() => tools.handoff(text)),
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

  registerBrowserTools(server, tools);
  return server;
}
