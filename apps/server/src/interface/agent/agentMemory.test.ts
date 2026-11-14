import { describe, expect, it } from 'vitest';
import { agentBody } from '../../testing/harness.js';
import { setupAgents } from '../../testing/agentKit.js';
import { createAgentTools } from './agentTools.js';

async function setup() {
  const s = await setupAgents();
  const codex = await s.h.sessions.create({ ...agentBody('/other'), provider: 'codex' });
  const other = createAgentTools(s.deps, codex.id).memory;
  const noticesOf = async (id: string) =>
    (await s.h.sessions.snapshot(id)).events.filter((e) => e.t === 'notice');
  return { ...s, memory: s.tools.memory, other, codex, noticesOf };
}

describe('the agent memory tool', () => {
  it('writes to its own profile at once, shows a notice, and updates the same title', async () => {
    const { memory, h, a, noticesOf } = await setup();
    const first = await memory.write({ title: 'Stack', body: 'pnpm', folder: 'Work/Setup' });
    expect(first.status).toBe('saved');
    const saved = h.memory.entry(first.id as string);
    expect(saved).toMatchObject({ source: 'agent', profileId: 'claude', body: 'pnpm' });
    expect(
      h.memory
        .tree('profile', 'claude')
        .folders.map((f) => f.name)
        .sort(),
    ).toEqual(['Setup', 'Work']);
    const again = await memory.write({ title: 'Stack', body: 'npm', folder: 'Work/Setup' });
    expect(again).toMatchObject({ status: 'updated', id: first.id });
    expect(h.memory.entry(first.id as string)?.body).toBe('npm');
    expect(await noticesOf(a.id)).toHaveLength(2);
  });

  it('lists titles, ids and folders; reads global and own notes only', async () => {
    const { memory, other, h } = await setup();
    await h.memory.notes.create({ scope: 'global', title: 'G', body: 'global text' });
    const mine = await memory.write({ title: 'Mine', body: 'secret mine' });
    const list = memory.list() as Array<{ scope: string; notes: Array<{ title: string }> }>;
    expect(list.map((l) => l.scope)).toEqual(['global', 'profile']);
    expect(list[1]?.notes[0]?.title).toBe('Mine');
    expect(memory.read(h.memory.tree('global').entries[0]?.id ?? '').body).toBe('global text');
    expect(() => other.read(mine.id as string)).toThrow(/approved import/);
    const peek = other.list('profile', 'claude');
    expect(peek).toMatchObject({ titlesOnly: true, notes: [{ title: 'Mine' }] });
    expect(JSON.stringify(peek)).not.toContain('secret');
  });

  it('asks for approval to write a global note, and does it only when approved', async () => {
    const { memory, h, deps } = await setup();
    const asked = await memory.write({ title: 'Rule', body: 'be kind', scope: 'global' });
    expect(asked.status).toBe('pending approval');
    expect(h.memory.tree('global').entries).toEqual([]);
    const request = deps.approvals.get(asked.requestId as string);
    expect(request).toMatchObject({
      kind: 'memory',
      memory: { action: 'write-global', title: 'Rule' },
    });
    await deps.approvals.decide(request.id, 'approve');
    expect(h.memory.tree('global').entries[0]).toMatchObject({ title: 'Rule', source: 'agent' });
    const rejected = await memory.write({ title: 'No', body: '', scope: 'global' });
    await deps.approvals.decide(rejected.requestId as string, 'reject');
    expect(h.memory.tree('global').entries).toHaveLength(1);
  });

  it('imports from another profile only after approval, showing titles and folders to approve', async () => {
    const { memory, other, h, deps, codex } = await setup();
    const folder = await h.memory.folders.create({
      scope: 'profile',
      profileId: 'claude',
      name: 'Work',
    });
    const note = await h.memory.notes.create({
      scope: 'profile',
      profileId: 'claude',
      folderId: folder.id,
      title: 'T',
      body: 'B',
    });
    const asked = other.importFrom('claude', [], [folder.id]);
    expect(asked.status).toBe('pending approval');
    const request = deps.approvals.get(asked.requestId);
    expect(request.sessionId).toBe(codex.id);
    expect(request.memory).toMatchObject({
      action: 'import',
      fromProfile: 'claude',
      toProfile: 'codex',
      entries: [{ id: note.id, title: 'T' }],
      folders: [{ id: folder.id, name: 'Work' }],
    });
    expect(h.memory.tree('profile', 'codex').entries).toEqual([]);
    await deps.approvals.decide(request.id, 'approve');
    expect(h.memory.tree('profile', 'codex').entries[0]).toMatchObject({
      title: 'T',
      source: 'import',
      importedFrom: 'claude',
    });
    expect(() => memory.importFrom('claude')).toThrow(/own profile/);
    expect(() => other.importFrom('claude', ['nope'])).toThrow(/not found/);
  });

  it('deletes only notes of its own profile', async () => {
    const { memory, other, h } = await setup();
    const mine = await memory.write({ title: 'a', body: '' });
    const global = await h.memory.notes.create({ scope: 'global', title: 'g', body: '' });
    await expect(other.delete(mine.id as string)).rejects.toThrow(/own profile/);
    await expect(memory.delete(global.id)).rejects.toThrow(/own profile/);
    expect(await memory.delete(mine.id as string)).toEqual({ status: 'deleted' });
  });

  it('names the profiles, marking the caller', async () => {
    const { memory } = await setup();
    expect(memory.profiles().find((p) => p.you)?.id).toBe('claude');
  });
  it('paginates titles without exposing another profile body and preserves the CLI list shape', async () => {
    const { memory, other } = await setup();
    await memory.write({ title: 'A', body: 'private A' });
    await memory.write({ title: 'B', body: 'private B' });
    const first = memory.list('profile', undefined, { offset: 0, limit: 1 });
    expect(first).toMatchObject({ total: 2, notes: [{ title: 'A' }], nextOffset: 1 });
    const second = memory.list('profile', undefined, { offset: 1, limit: 1 });
    expect(second).toMatchObject({ notes: [{ title: 'B' }], nextOffset: null });
    expect(Array.isArray(memory.list())).toBe(true);
    const peek = other.list('profile', 'claude', { offset: 0, limit: 1 });
    expect(peek).toMatchObject({ titlesOnly: true, total: 2, notes: [{ title: 'A' }] });
    expect(JSON.stringify(peek)).not.toContain('private');
  });
});
