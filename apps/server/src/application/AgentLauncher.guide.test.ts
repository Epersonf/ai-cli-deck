import { describe, expect, it } from 'vitest';
import { createProviderRegistry } from '../infrastructure/providers/registry.js';
import { agentBody, createHarness } from '../testing/harness.js';
import { AgentLauncher } from './AgentLauncher.js';
import type { RunState } from './ChatSettings.js';

const state = (chatId: string | null): RunState => ({
  config: { model: null, mode: 'default', effort: null },
  chatId,
  fork: false,
  resumeAt: null,
  dropsTurn: null,
});

async function setup() {
  const h = createHarness();
  const { id } = await h.sessions.create(agentBody());
  const session = h.sessions.get(id);
  if (!session) throw new Error('no session');
  let devices: string[] = [];
  let notes = '';
  const launcher = new AgentLauncher({
    providers: createProviderRegistry(),
    mcpBaseUrl: 'http://127.0.0.1:1/mcp',
    deckUrl: 'http://127.0.0.1:1',
    binDir: null,
    baseEnv: {},
    pairedDevices: () => devices,
    memoryBriefing: () => notes,
  });
  return {
    session,
    launcher,
    change: (next: { devices?: string[]; notes?: string }) => {
      devices = next.devices ?? devices;
      notes = next.notes ?? notes;
    },
  };
}

describe('the briefing at the start of every request', () => {
  it('stays as it was for the whole conversation, whatever changes around it', async () => {
    const { session, launcher, change } = await setup();
    const first = launcher.spec(session, state(null)).guide;
    change({ devices: ['PC'], notes: 'Memory: use tabs' });
    expect(launcher.spec(session, state('chat-1')).guide).toBe(first);
    expect(launcher.envFor(session)['DECK_SESSION_ID']).toBe(session.id);
    expect(launcher.spec(session, state('chat-1')).guide).toBe(first);
  });

  it('is written again when a new conversation starts', async () => {
    const { session, launcher, change } = await setup();
    const first = launcher.spec(session, state(null)).guide;
    change({ devices: ['PC'], notes: 'Memory: use tabs' });
    const next = launcher.spec(session, state(null)).guide;
    expect(next).not.toBe(first);
    expect(next).toContain('PC');
    expect(next).toContain('use tabs');
    expect(launcher.spec(session, state('chat-2')).guide).toBe(next);
  });
  it('selects the smaller guide only for Codex profiles', async () => {
    const { session, launcher } = await setup();
    const claude = launcher.spec(session, state(null)).guide;
    const codex = launcher.spec(
      { ...session, id: 'codex-chat', provider: 'codex' },
      state(null),
    ).guide;
    expect(claude).toContain('Other commands you should know exist:');
    expect(codex).not.toContain('Other commands you should know exist:');
    expect(codex).toContain('Keep tool output focused');
  });
});
