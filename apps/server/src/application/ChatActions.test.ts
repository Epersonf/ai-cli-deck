import { describe, expect, it } from 'vitest';
import { createHarness, customBody } from '../testing/harness.js';

const claude = { ...customBody('/work'), provider: 'claude', command: null };
const later = new Date(Date.UTC(2026, 0, 1, 0, 30));
const theChat = {
  id: 'abc-123',
  path: '/chats/abc-123.jsonl',
  title: 'fix the login bug',
  startedAt: later,
  updatedAt: later,
};

/** A Claude terminal that had a conversation and has ended. */
async function ended() {
  const h = createHarness({ tmux: false });
  const { id } = await h.sessions.create(claude);
  h.reader.chats = [theChat];
  h.reader.turns.set('abc-123', [
    { role: 'user', text: 'fix the login bug' },
    { role: 'tool', text: 'Bash: npm test' },
    { role: 'assistant', text: 'Fixed: the token was not refreshed.' },
  ]);
  h.ptyPort.spawned[0]?.pty.exit(0);
  return { h, id, args: (n: number) => h.ptyPort.spawned[n]?.spec.args ?? [] };
}

describe('continuing a conversation', () => {
  it('restarts an ended terminal on the same chat with its own CLI', async () => {
    const { h, id, args } = await ended();
    await h.chatActions.restart(id, { mode: 'continue' });
    expect(args(1).slice(0, 2)).toEqual(['--resume', 'abc-123']);
    expect(h.sessions.get(id)?.status).toBe('running');
  });

  it('starts a fresh chat when asked for a new one', async () => {
    const { h, id, args } = await ended();
    await h.chatActions.restart(id, { mode: 'new' });
    expect(args(1).join(' ')).not.toMatch(/--resume|deck\]/);
  });

  it('moves the conversation to another AI as a transcript it is asked to read', async () => {
    const { h, id, args } = await ended();
    await h.chatActions.restart(id, { mode: 'continue', provider: 'codex' });
    expect(h.sessions.get(id)?.provider).toBe('codex');
    const [file, text] = [...h.chatFiles.transcripts.entries()][0] ?? [];
    expect(file).toMatch(/^\/work\/\.deck\/chats\/.+\.md$/);
    expect(text).toContain('## User\n\nfix the login bug');
    expect(text).toContain('→ Bash: npm test');
    expect(args(1)[0]).toMatch(
      /^\[deck\] This chat continues a conversation the user had with Claude Code/,
    );
    expect(args(1)[0]).toContain('.deck/chats/');
  });

  it('forks natively in the same CLI, and hands over to another', async () => {
    const { h, id, args } = await ended();
    const copy = await h.chatActions.fork(id, {});
    expect(args(1).slice(0, 3)).toEqual(['--resume', 'abc-123', '--fork-session']);
    expect(copy.cwd).toBe('/work');
    await h.chatActions.fork(id, { provider: 'codex' });
    expect(args(2)[0]).toContain('[deck] This chat continues');
  });

  it('types the first message for a CLI that takes none on its command line', async () => {
    const { h, id } = await ended();
    h.providers.add({
      id: 'tiny-ai',
      label: 'Tiny AI',
      buildCommand: () => ({ command: 'tiny', args: [], env: {} }),
      buildMcpConfig: () => ({ args: [], env: {} }),
    });
    await h.chatActions.restart(id, { mode: 'continue', provider: 'tiny-ai' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const typed = h.ptyPort.spawned.at(-1)?.pty.writes.join('') ?? '';
    expect(typed).toContain('[deck] This chat continues');
    expect(typed.endsWith('\r')).toBe(true);
  });

  it('never types a conversation into a plain shell', async () => {
    const { h, id } = await ended();
    await h.chatActions.restart(id, { mode: 'continue', provider: 'shell' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.ptyPort.spawned.at(-1)?.pty.writes).toEqual([]);
    expect(h.chatFiles.transcripts.size).toBe(0);
  });

  it('opens a saved chat in a new terminal, and nothing that is not one', async () => {
    const { h, args } = await ended();
    const opened = await h.chatActions.open({
      provider: 'claude',
      cwd: '/work',
      chatId: 'abc-123',
    });
    expect(args(1).slice(0, 2)).toEqual(['--resume', 'abc-123']);
    expect(h.sessions.get(opened.id)?.meta['chat']).toBe('abc-123');
    const missing = { provider: 'claude', cwd: '/work', chatId: 'nope' };
    await expect(h.chatActions.open(missing)).rejects.toThrow(/not found/i);
  });
});
