import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { ApprovalService } from '../../application/ApprovalService.js';
import { BrowserService } from '../../application/BrowserService.js';
import { PreviewService } from '../../application/PreviewService.js';
import { FakeBrowserEngine } from '../../testing/fakeBrowser.js';
import { applyMemoryRequest } from '../../application/memoryApply.js';
import { memoryAccess } from '../../testing/memoryKit.js';
import { createHarness, agentBody } from '../../testing/harness.js';
import { createAgentTools } from '../agent/agentTools.js';
import { buildMcpServer } from './mcpServer.js';

async function connect() {
  const h = createHarness();
  const session = await h.sessions.create(agentBody('/work', true));
  const approvals = new ApprovalService({
    sessions: h.sessions,
    worktrees: { add: () => Promise.reject(new Error('git must not run')) },
    system: h.system,
    bus: h.bus,
    memory: { apply: (r) => applyMemoryRequest(h.memory, r) },
  });
  const tools = createAgentTools(
    {
      sessions: h.sessions,
      phone: null,
      tasks: h.tasks,
      approvals,
      memoryAccess: memoryAccess(h.memory, {
        approvals,
        providers: h.providers,
        sessions: h.sessions,
      }),
      preview: new PreviewService(h.sessions, h.bus),
      browser: new BrowserService(new FakeBrowserEngine()),
    },
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
  it('exposes exactly the session and browser tools', async () => {
    const client = await connect();
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'browser_click',
      'browser_fill',
      'browser_navigate',
      'browser_press',
      'browser_screenshot',
      'browser_scroll',
      'browser_snapshot',
      'browser_type',
      'get_request_status',
      'list_sessions',
      'memory',
      'open_preview',
      'propose_folder',
      'propose_worktree',
      'session_meta',
      'session_title',
      'suggest_new_tab',
      'task',
    ]);
  });

  it('drives the browser through the same page the user sees', async () => {
    const client = await connect();
    await client.callTool({ name: 'browser_navigate', arguments: { url: '3000' } });
    const snapshot = await client.callTool({ name: 'browser_snapshot', arguments: {} });
    expect(textOf(snapshot)).toContain('Hello');
    const shot = await client.callTool({ name: 'browser_screenshot', arguments: {} });
    expect((shot as { content: Array<{ type: string }> }).content[0]?.type).toBe('image');
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
