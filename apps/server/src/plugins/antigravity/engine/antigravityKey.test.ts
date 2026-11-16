import { describe, expect, it } from 'vitest';
import { input, setup } from './antigravityTestKit.js';

describe('explicit Gemini key authentication', () => {
  it('authenticates with the official ACP method before opening a conversation', async () => {
    const test = await setup({ GEMINI_API_KEY: 'private-key' });
    test.run.send(input());
    await test.done();
    const calls = await test.calls();
    expect(calls.find((call) => call.method === 'authenticate')?.params).toEqual({
      methodId: 'gemini-api-key',
    });
    expect(calls.findIndex((call) => call.method === 'authenticate')).toBeLessThan(
      calls.findIndex((call) => call.method === 'session/new'),
    );
    expect(JSON.stringify(calls)).not.toContain('private-key');
  });
  it('rejects unsupported key authentication instead of silently using the Google account', async () => {
    const test = await setup({ GEMINI_API_KEY: 'private-key', AGY_TEST_NO_KEY_AUTH: '1' });
    test.run.send(input());
    await test.done();
    expect((await test.calls()).some((call) => call.method === 'session/prompt')).toBe(false);
    expect(test.events.at(-1)).toMatchObject({
      t: 'turn-end',
      error: expect.stringContaining('Update agy'),
    });
  });
});
