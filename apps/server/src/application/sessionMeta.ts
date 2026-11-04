import { META_LIMITS } from '@deck/shared';
import { invalid } from '../domain/errors.js';

const KEY = /^[a-z0-9][a-z0-9_.-]*$/i;
const size = (meta: Record<string, string>): number =>
  Object.entries(meta).reduce((sum, [key, value]) => sum + key.length + value.length, 0);

/**
 * The notes of a session after setting `key` (an empty value removes it). Kept deliberately small:
 * these are pointers such as a chat id, never the conversation itself.
 */
export function withMeta(
  meta: Readonly<Record<string, string>>,
  key: string,
  value: string,
): Record<string, string> {
  if (key.length > META_LIMITS.keyLength || !KEY.test(key))
    throw invalid(`Key must be letters, digits, "_", "." or "-" (max ${META_LIMITS.keyLength})`);
  const rest = Object.fromEntries(Object.entries(meta).filter(([name]) => name !== key));
  if (value === '') return rest;
  if (value.length > META_LIMITS.valueLength)
    throw invalid(
      `Value too long (max ${META_LIMITS.valueLength} characters): keep ids, not content`,
    );
  const next = { ...rest, [key]: value };
  if (Object.keys(next).length > META_LIMITS.keys)
    throw invalid(`Too many keys (max ${META_LIMITS.keys}): remove one first`);
  if (size(next) > META_LIMITS.totalLength) throw invalid('Notes too large: keep ids, not content');
  return next;
}

/** Splits a saved argument list the way a shell would for plain words and quotes. */
export function splitArgs(text: string): string[] {
  const args: string[] = [];
  for (const match of text.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)) {
    args.push(match[1] ?? match[2] ?? match[3] ?? '');
  }
  return args;
}
