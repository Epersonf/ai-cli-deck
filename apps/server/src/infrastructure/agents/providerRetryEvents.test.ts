import { describe, expect, it } from 'vitest';
import { mapClaudeMessage, newMapState, type SdkMessage } from './claudeMap.js';
import { sink } from './fakeClaude.js';
import { friendlyError } from './codexState.js';
import { run } from './codexTestKit.js';

function claude(messages: SdkMessage[]) {
  const { s, events } = sink();
  const state = newMapState();
  for (const message of messages) mapClaudeMessage(message, state, s);
  return events.filter((event) => event.t === 'turn-end');
}
describe('provider signals for waiting', () => {
  it('pauses on a rejected Claude plan window, but not on a warning', () => {
    expect(
      claude([
        {
          type: 'rate_limit_event',
          rate_limit_info: { status: 'allowed_warning', utilization: 0.95 },
        },
      ]),
    ).toEqual([]);
    expect(
      claude([
        {
          type: 'rate_limit_event',
          rate_limit_info: { status: 'rejected', resetsAt: 1_900_000_000 },
        },
      ]),
    ).toMatchObject([
      { retry: { kind: 'usage', retryAt: new Date(1_900_000_000_000).toISOString() } },
    ]);
  });
  it('detects the SDK synthetic rate-limit answer even when its result says success', () => {
    expect(
      claude([
        {
          type: 'assistant',
          error: 'rate_limit',
          message: { content: [{ type: 'text', text: "You've hit your limit" }] },
        },
        { type: 'result', subtype: 'success' },
      ]),
    ).toMatchObject([{ error: "You've hit your limit", retry: { kind: 'usage' } }]);
  });
  it('does not authorize waiting for a credits-required rejection or a billing error', () => {
    const events = claude([
      {
        type: 'rate_limit_event',
        rate_limit_info: { status: 'rejected', errorCode: 'credits_required' },
      },
      {
        type: 'assistant',
        error: 'billing_error',
        message: { content: [{ type: 'text', text: 'Usage limit reached; buy credits' }] },
      },
      { type: 'result', subtype: 'success' },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ retry: null });
  });
  it('does not revive a synthetic transient error after the SDK already recovered', () => {
    expect(
      claude([
        { type: 'assistant', error: 'overloaded', message: { content: [] } },
        {
          type: 'assistant',
          message: { model: 'claude-sonnet', content: [{ type: 'text', text: 'Done.' }] },
        },
        { type: 'result', subtype: 'success' },
      ]),
    ).toMatchObject([{ error: null }]);
  });
  it('preserves a Codex reset timestamp across its error and turn.failed events', () => {
    const { events } = run([
      JSON.stringify({
        type: 'error',
        error: {
          message: 'Usage limit reached',
          code: 'usage_limit_reached',
          resets_at: 1_900_000_000,
        },
      }),
      JSON.stringify({ type: 'turn.failed', error: { message: 'Usage limit reached' } }),
    ]);
    expect(events.at(-1)).toMatchObject({
      retry: { kind: 'usage', retryAt: new Date(1_900_000_000_000).toISOString() },
    });
  });
  it('does not mislabel an API-key rate limit as a sign-in failure', () => {
    const message = '429 rate limit reached for an API key profile';
    expect(friendlyError(message)).toBe(message);
    expect(friendlyError('Missing API key')).toContain('AUTH: ');
  });
});
