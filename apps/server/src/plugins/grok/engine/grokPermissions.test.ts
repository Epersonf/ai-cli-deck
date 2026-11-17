import { describe, expect, it, vi } from 'vitest';
import { input, setup } from './grokTestKit.js';

describe('Grok Build permissions', () => {
  it('asks the person before a tool runs and answers with the CLI option ids', async () => {
    const t = await setup();
    t.run.send(input('do it permission'));
    await vi.waitFor(() => expect(t.events.some((event) => event.t === 'permission')).toBe(true));
    expect(t.events).toContainEqual(
      expect.objectContaining({
        t: 'permission',
        id: 'grok:permission:permission-1',
        canAlways: true,
      }),
    );
    t.run.answer('grok:permission:permission-1', { allow: true, always: true });
    await t.done();
    expect(t.events).toContainEqual({
      t: 'permission-done',
      id: 'grok:permission:permission-1',
      allowed: true,
    });
    const answer = (await t.calls()).find((call) => call.id === 'permission-1');
    expect(answer?.result).toEqual({ outcome: { outcome: 'selected', optionId: 'always' } });
  });

  it('approves by itself what the permission mode allows, and asks about the rest', async () => {
    const edits = await setup({}, { mode: 'acceptEdits' });
    edits.run.send(input('please edit permission'));
    await edits.done();
    expect(edits.events.some((event) => event.t === 'permission')).toBe(false);
    expect((await edits.calls()).find((call) => call.id === 'permission-1')?.result).toEqual({
      outcome: { outcome: 'selected', optionId: 'once' },
    });
    const commands = await setup({}, { mode: 'acceptEdits' });
    commands.run.send(input('run it permission'));
    await vi.waitFor(() =>
      expect(commands.events.some((event) => event.t === 'permission')).toBe(true),
    );
    const bypass = await setup({}, { mode: 'bypassPermissions' });
    bypass.run.send(input('run it permission'));
    await bypass.done();
    expect(bypass.events.some((event) => event.t === 'permission')).toBe(false);
  });
});
