import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { ApprovalService } from '../../application/ApprovalService.js';
import { PreviewService } from '../../application/PreviewService.js';
import { createHarness, customBody } from '../../testing/harness.js';
import { createAgentTools } from '../agent/agentTools.js';
import { buildMcpServer } from './mcpServer.js';

async function connect() {
  const h = createHarness();
  const session = await h.sessions.create(customBody('/work', true));
  const approvals = new ApprovalService({
    sessions: h.sessions,
    worktrees: { add: () => Promise.reject(new Error('git must not run')) },
    system: h.system,
    bus: h.bus,
  });
  const tools = createAgentTools(
    { sessions: h.sessions, approvals, preview: new PreviewService(h.sessions, h.bus) },
    session.id,
  );
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await buildMcpServer(tools).connect(serverSide);
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(clientSide);
  return client;
}

const textOf = (result: unknown): string =>
  (result as { content: Array<{ text: string }> }).content[0]?.text ?? '';

describe('MCP server', () => {
  it('exposes exactly the five session tools', async () => {
    const client = await connect();
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'get_request_status',
      'list_sessions',
      'open_preview',
      'propose_worktree',
      'suggest_new_tab',
    ]);
  });

  it('proposes a worktree, then reports it as pending', async () => {
    const client = await connect();
    const proposed = await client.callTool({
      name: 'propose_worktree',
      arguments: { reason: 'isolate' },
    });
    const { requestId, status } = JSON.parse(textOf(proposed)) as {
      requestId: string;
      status: string;
    };
    expect(status).toBe('pending');
    const polled = await client.callTool({ name: 'get_request_status', arguments: { requestId } });
    expect(JSON.parse(textOf(polled))).toEqual({ status: 'pending', path: null });
  });

  it('returns tool errors instead of crashing for rejected URLs', async () => {
    const client = await connect();
    const result = await client.callTool({
      name: 'open_preview',
      arguments: { url: 'https://example.com' },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('localhost');
  });
});
