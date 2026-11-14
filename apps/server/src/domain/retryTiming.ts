import { retryClock } from './retryClock.js';
type Json = Record<string, unknown>;
export const record = (value: unknown): Json =>
  typeof value === 'object' && value !== null ? (value as Json) : {};

/** Read only explicit epochs/ISO dates or Retry-After. Never guess the CLI user's time zone. */
export function retryTime(error: unknown, text: string, now: number): string | null {
  const root = record(error);
  const data = { ...record(root['error']), ...root };
  const epoch = data['resets_at'] ?? data['resetsAt'] ?? data['retry_at'] ?? data['retryAt'];
  let at =
    typeof epoch === 'number'
      ? epoch < 1e12
        ? epoch * 1000
        : epoch
      : typeof epoch === 'string' && /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(epoch)
        ? Date.parse(epoch)
        : NaN;
  const headerSource = root['headers'] ?? record(root['error'])['headers'];
  const headers = record(headerSource);
  const get = headers['get'];
  const header =
    typeof get === 'function'
      ? (Reflect.apply(get, headerSource, ['retry-after']) as unknown)
      : (headers['retry-after'] ?? headers['Retry-After']);
  const after = header ?? data['retry_after_seconds'] ?? data['retry_after'] ?? data['retryAfter'];
  if (!Number.isFinite(at) && (typeof after === 'string' || typeof after === 'number')) {
    const seconds = Number(after);
    at =
      Number.isFinite(seconds) && seconds >= 0 ? now + seconds * 1000 : Date.parse(String(after));
  }
  if (!Number.isFinite(at)) {
    const seconds = /["']?(?:resets_at|resetsAt)["']?\s*[:=]\s*(\d{10,13})\b/.exec(text)?.[1];
    const iso =
      /(?:try again at|retry at|resets? at)\s+(\d{4}-\d\d-\d\dT[\d:.]+(?:Z|[+-]\d\d:\d\d))/i.exec(
        text,
      )?.[1];
    const delay = /retry[-_ ]after["']?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:s|seconds)?/i.exec(
      text,
    )?.[1];
    if (seconds) at = Number(seconds) * (seconds.length <= 10 ? 1000 : 1);
    else if (iso) at = Date.parse(iso);
    else if (delay) at = now + Number(delay) * 1000;
  }
  if (!Number.isFinite(at)) at = retryClock(text, now);
  return Number.isFinite(at) && at >= now && at < 8.64e15 ? new Date(at).toISOString() : null;
}
