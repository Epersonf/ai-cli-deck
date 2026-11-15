import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import type { AgentTools } from '../agent/agentTools.js';
import { buildMcpServer } from './mcpServer.js';

async function connect(compact: boolean) {
  const log = 'A'.repeat(13000) + 'END';
  const tools = {
    phoneEnabled: false,
    listSessions: () => Array.from({ length: 30 }, (_, id) => ({ id })),
    browserOutline: () => Promise.resolve({ outline: 'B'.repeat(17000) + 'END' }),
    taskLog: () => ({ text: log }),
  } as unknown as AgentTools;
  const [a, b] = InMemoryTransport.createLinkedPair();
  const server = buildMcpServer(tools, null, compact);
  await server.connect(b);
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(a);
  const call = async (name: string, args = {}) => {
    const result = await client.callTool({ name, arguments: args });
    const content = result.content as Array<{ text: string }>;
    return JSON.parse(content[0]?.text ?? '{}') as Record<string, unknown>;
  };
  return {
    call,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

describe('Codex MCP output budgets', () => {
  it('paginates without losing log or snapshot content', async () => {
    const c = await connect(true);
    try {
      expect((await c.call('list_sessions')).nextOffset).toBe(20);
      const first = await c.call('task', { action: 'log', id: 'job' });
      expect(first.nextOffset).toBe(12000);
      const next = await c.call('task', { action: 'log', id: 'job', offset: first.nextOffset });
      expect(String(first.text) + String(next.text)).toBe('A'.repeat(13000) + 'END');
      expect(next.nextOffset).toBeNull();
      expect((await c.call('browser_snapshot')).nextOffset).toBe(6000);
      expect((await c.call('browser_snapshot', { limit: 40000 })).outline).toBe(
        'B'.repeat(17000) + 'END',
      );
    } finally {
      await c.close();
    }
  });
  it('keeps other agents defaults and allows explicit pagination', async () => {
    const c = await connect(false);
    try {
      expect((await c.call('list_sessions')).nextOffset).toBeNull();
      expect((await c.call('browser_snapshot')).nextOffset).toBe(16000);
      expect(await c.call('task', { action: 'log', id: 'job' })).toEqual({
        text: 'A'.repeat(13000) + 'END',
      });
      expect((await c.call('task', { action: 'log', id: 'job', limit: 100 })).nextOffset).toBe(100);
    } finally {
      await c.close();
    }
  });
});
