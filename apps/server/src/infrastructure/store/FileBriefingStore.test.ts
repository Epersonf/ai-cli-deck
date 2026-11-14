import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentLauncher } from '../../application/AgentLauncher.js';
import type { RunState } from '../../application/ChatSettings.js';
import { agentBody, createHarness } from '../../testing/harness.js';
import { FileBriefingStore } from './FileBriefingStore.js';

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
const state = (chatId: string | null): RunState => ({
  chatId,
  fork: false,
  resumeAt: null,
  dropsTurn: null,
  config: { model: null, effort: null, mode: 'default' },
});

describe('private stable briefings', () => {
  it('preserves exact instructions across restart, refreshes for new chats and isolates profiles', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'deck-briefing-'));
    dirs.push(dir);
    const h = createHarness();
    const session = await h.sessions.create({ ...agentBody(), provider: 'codex' });
    const launcher = (notes: string) =>
      new AgentLauncher({
        providers: h.providers,
        baseEnv: {},
        binDir: null,
        mcpBaseUrl: 'http://localhost:1/mcp',
        deckUrl: 'http://localhost:1',
        briefingStore: new FileBriefingStore(dir),
        memoryBriefing: () => notes,
      });
    const original = launcher('original notes').spec(session, state(null)).guide;
    const restored = launcher('new notes');
    expect(restored.spec(session, state('thread-1')).guide).toBe(original);
    const fork = { ...session, id: 'forked' };
    restored.inherit(session, fork);
    expect(launcher('different notes').spec(fork, state('thread-1')).guide).toBe(original);
    expect(restored.spec(session, state(null)).guide).toContain('new notes');
    expect(
      launcher('claude notes').spec({ ...session, provider: 'claude' }, state('claude-thread'))
        .guide,
    ).toContain('claude notes');
    expect(JSON.stringify(h.sessions.get(session.id))).not.toContain('original notes');
    restored.forget(session.id);
    expect(new FileBriefingStore(dir).read(session.id)).toBeNull();
  });

  it('rejects a corrupted snapshot instead of trusting altered instructions', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'deck-briefing-'));
    dirs.push(dir);
    const store = new FileBriefingStore(dir);
    store.write('id', {
      version: 1,
      provider: 'codex',
      guide: 'stable',
      hash: createHash('sha256').update('stable').digest('hex'),
    });
    const path = join(dir, (await readdir(dir))[0] ?? 'missing');
    const json = JSON.parse(await readFile(path, 'utf8')) as { guide: string };
    json.guide = 'altered';
    await writeFile(path, JSON.stringify(json));
    expect(store.read('id')).toBeNull();
  });
});
