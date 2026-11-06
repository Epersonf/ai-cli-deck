import { Readable } from 'node:stream';
import { DeckError, notFound } from '../../domain/errors.js';
import type { Mux } from './mux.js';
import { tunnelRequest } from './tunnelClient.js';

const text = async (body: Readable): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of body) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
};

const parse = (raw: string): unknown => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // not JSON (an HTML error page)
  }
};

const errorOf = (json: unknown, status: number): string => {
  const error = (json as { error?: unknown } | null)?.error;
  return typeof error === 'string' ? error : `The other deck answered ${status}`;
};

/** A JSON call to a paired deck's API through the link; its errors come back as this deck's. */
export async function peerCall(
  link: Promise<Mux>,
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const json = body !== undefined;
  const response = await tunnelRequest(await link, {
    method,
    path,
    headers: json ? { 'content-type': 'application/json' } : {},
    body: json ? Readable.from([Buffer.from(JSON.stringify(body))]) : null,
  });
  const parsed = parse(await text(response.body));
  if (response.status === 404) throw notFound(errorOf(parsed, 404).replace(/ not found$/, ''));
  if (response.status >= 400) throw new DeckError('unavailable', errorOf(parsed, response.status));
  return parsed;
}
