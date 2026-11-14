import type { RetryHint } from '@deck/shared';
import { record, retryTime } from './retryTiming.js';

const PERMANENT =
  /insufficient[_ ](?:quota|balance|credits)|billing[_ ]error|credits_required|spend[_ ]limit|account[_ ]on[_ ]hold|verification_required|budget[_ ]exceeded|exceeded your current quota|usage_limit_exceeded|(?:organization|project)_usage_limit_exceeded|invalid[_ ](?:api[_ ]?key|request)|unauthori[sz]ed|authentication[_ ](?:failed|error)|context[_ ]?window|max[_ ]?(?:turns|budget|output)|cloud_credential_error/i;
const USAGE =
  /usage[_ ]?limit(?:[_ ]?(?:reached|exceeded))?|you['’]?ve (?:hit|reached) your (?:\w+ )?limit|(?:weekly|session|5.hour) (?:usage )?limit (?:reached|exceeded)/i;
const RATE = /\b429\b|rate[_ ]?limit|too many requests|resource_exhausted|slow_down/i;
const OVERLOAD = /\b50[03]\b|overloaded|server_overloaded|server_error|service_unavailable/i;

/** Billing/auth/context/budget failures are deliberately excluded, even when they also say 429. */
export function providerRetry(error: unknown, now = Date.now()): RetryHint | null {
  let root = record(error);
  const raw = typeof error === 'string' ? error.slice(0, 8000) : '';
  if (raw.includes('{')) {
    try {
      root = record(JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)));
    } catch {
      /* CLI text. */
    }
  }
  const nested = record(root['error']);
  const info = root['codexErrorInfo'] ?? nested['codexErrorInfo'];
  const http = record(record(info)['httpConnectionFailed']);
  const text = [
    raw,
    root['message'],
    root['code'],
    root['type'],
    root['status'],
    root['statusCode'],
    root['httpStatusCode'],
    nested['message'],
    nested['code'],
    nested['type'],
    typeof info === 'string' ? info : '',
    http['httpStatusCode'],
  ]
    .filter((v) => typeof v === 'string' || typeof v === 'number')
    .join(' ');
  const status =
    root['status'] ??
    root['statusCode'] ??
    root['httpStatusCode'] ??
    nested['status'] ??
    http['httpStatusCode'];
  if (
    [400, 401, 402, 403, 404].includes(Number(status)) ||
    /^\s*40[01234]\b/.test(raw) ||
    /\b(?:HTTP(?:\/[\d.]+)?|API[ _]?Error|status(?: code)?)[:=\s]+40[01234]\b/i.test(raw) ||
    PERMANENT.test(text)
  )
    return null;
  const kind = USAGE.test(text)
    ? 'usage'
    : RATE.test(text)
      ? 'rate'
      : OVERLOAD.test(text)
        ? 'overloaded'
        : null;
  return kind ? { kind, retryAt: retryTime(root, text, now) } : null;
}
