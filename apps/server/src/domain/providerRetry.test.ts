import { describe, expect, it } from 'vitest';
import { providerRetry } from './providerRetry.js';

const now = Date.parse('2026-01-01T00:00:00Z');
describe('temporary provider failures', () => {
  it.each([
    ['You have hit your usage limit. Please try again later.', 'usage'],
    ["You've hit your limit · resets 5pm (America/Sao_Paulo)", 'usage'],
    ['usageLimitExceeded', 'usage'],
    ['rate_limit_exceeded', 'rate'],
    ['API Error: 429 Too Many Requests', 'rate'],
    ['503 Server Overloaded', 'overloaded'],
    ['API Error: 500 Server Error', 'overloaded'],
  ])('offers continuation for %s', (text, kind) => {
    expect(providerRetry(text, now)).toMatchObject({ kind });
  });

  it.each([
    'API Error: 402 {"error":{"type":"rate_limit_error","message":"Payment required"}}',
    '429 insufficient_quota',
    '429 You exceeded your current quota, please check your plan and billing details',
    '429 organization_usage_limit_exceeded',
    '402 Insufficient Balance',
    '401 Unauthorized',
    '429 project_spend_limit_exceeded',
    '429 organization_spend_limit_exceeded',
    'credits_required usage_limit_reached',
    'billing_error rate_limit',
    'context_window_exceeded',
    'error_max_turns',
    'max_budget_exceeded',
    'max_output_tokens',
    'Authentication failed: rate limit',
    'Permission denied',
    'Network disconnected',
    'Task failed',
  ])('never retries permanent/ambiguous failure %s', (text) => {
    expect(providerRetry(text, now)).toBeNull();
  });

  it('uses structured Retry-After seconds or HTTP dates without losing error metadata', () => {
    expect(providerRetry({ status: 429, headers: { 'retry-after': '120' } }, now)?.retryAt).toBe(
      '2026-01-01T00:02:00.000Z',
    );
    expect(
      providerRetry(
        { status: 503, headers: new Headers({ 'retry-after': 'Thu, 01 Jan 2026 00:03:00 GMT' }) },
        now,
      )?.retryAt,
    ).toBe('2026-01-01T00:03:00.000Z');
  });

  it('reads Codex reset epochs in JSON error bodies and ignores ambiguous local clock times', () => {
    expect(
      providerRetry(
        'API Error: {"error":{"type":"usage_limit_reached","resets_at":1767225720}}',
        now,
      )?.retryAt,
    ).toBe('2026-01-01T00:02:00.000Z');
    expect(providerRetry("You've hit your limit · resets 5pm", now)?.retryAt).toBeNull();
    expect(
      providerRetry('usage_limit_reached; try again at 2026-01-01T00:03:00Z', now)?.retryAt,
    ).toBe('2026-01-01T00:03:00.000Z');
  });

  it('does not mistake token counts for HTTP status codes', () => {
    expect(providerRetry('429 rate limit exceeded for 400 tokens', now)?.kind).toBe('rate');
    expect(providerRetry({ status: 402, message: 'rate_limit' }, now)).toBeNull();
  });
});
