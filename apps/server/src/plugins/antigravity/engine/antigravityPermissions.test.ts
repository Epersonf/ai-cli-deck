import { describe, expect, it, vi } from 'vitest';
import { input, setup } from './antigravityTestKit.js';

describe('Antigravity permissions and shutdown', () => {
  it('answers permission requests with the exact offered option', async () => {
    const t = await setup();
    t.run.send(input('permission'));
    await vi.waitFor(() => expect(t.events.some((event) => event.t === 'permission')).toBe(true));
    const permission = t.events.find((event) => event.t === 'permission');
    expect(permission).toMatchObject({ canAlways: true, tool: 'Write a file' });
    t.run.answer(permission?.id ?? 'missing', { allow: true, always: true });
    await t.done();
    expect((await t.calls()).find((call) => call.id === 'permission-1')?.result).toEqual({
      outcome: { outcome: 'selected', optionId: 'always' },
    });
  });

  it('cancels pending permissions and permits the next turn', async () => {
    const t = await setup();
    t.run.send(input('permission'));
    await vi.waitFor(() => expect(t.events.some((event) => event.t === 'permission')).toBe(true));
    t.run.interrupt();
    await t.done();
    expect((await t.calls()).find((call) => call.id === 'permission-1')?.result).toEqual({
      outcome: { outcome: 'cancelled' },
    });
    expect(t.events).toContainEqual({
      t: 'turn-end',
      error: null,
      costUsd: null,
      durationMs: null,
    });
    t.run.send(input('hello again', 'second'));
    await t.done(2);
  });

  it.each([
    [{ AGY_TEST_AUTH_ERROR: '1' }, 'hello', 'AUTH: Authentication required'],
    [{}, 'crash', 'CLI crashed'],
  ])('releases failed runs once and reports the actual CLI error', async (env, text, error) => {
    const t = await setup(env);
    t.run.send(input(text));
    await t.done();
    expect(t.ended()).toBe(1);
    expect(t.events).toContainEqual({ t: 'turn-end', error, costUsd: null, durationMs: null });
  });

  it('rejects unsupported attachments before sending a model prompt', async () => {
    const t = await setup({ AGY_TEST_NO_IMAGES: '1' });
    t.run.send({ ...input(), images: [{ mediaType: 'image/png', data: 'aGVsbG8=' }] });
    await t.done();
    expect((await t.calls()).some((call) => call.method === 'session/prompt')).toBe(false);
    expect(t.events.at(-1)).toMatchObject({
      error: 'This Antigravity CLI does not support image attachments',
    });
  });

  it('does not emit late events after closing a running turn', async () => {
    const t = await setup();
    t.run.send(input('wait'));
    await vi.waitFor(async () =>
      expect((await t.calls()).some((call) => call.method === 'session/prompt')).toBe(true),
    );
    t.run.close();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(t.events).toEqual([]);
    expect(t.ended()).toBe(0);
  });
});
