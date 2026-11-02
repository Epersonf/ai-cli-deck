import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DeckError } from '../../domain/errors.js';
import type { AgentTools } from '../agent/agentTools.js';

interface TextResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

function run(action: () => unknown): TextResult {
  try {
    return { content: [{ type: 'text', text: JSON.stringify(action(), null, 2) }] };
  } catch (error) {
    if (!(error instanceof DeckError)) throw error;
    return { content: [{ type: 'text', text: error.message }], isError: true };
  }
}

/** One MCP server per request, bound to the calling session. No tool runs git or writes files. */
export function buildMcpServer(tools: AgentTools): McpServer {
  const server = new McpServer({ name: 'ai-cli-deck', version: '0.1.0' });

  server.registerTool(
    'list_sessions',
    { description: 'List the other sessions open in the deck (provider, folder, status).' },
    () => run(tools.listSessions),
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
  return server;
}
