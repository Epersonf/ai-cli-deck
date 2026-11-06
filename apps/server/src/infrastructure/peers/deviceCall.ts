import { Readable } from 'node:stream';
import { DeckError, notFound } from '../../domain/errors.js';
import type { Mux } from './mux.js';
import { tunnelRequest, type TunnelRequest, type TunnelResponse } from './tunnelClient.js';
import type { ServeTarget } from './tunnelServe.js';

/** One request to a device's API: a paired deck through its link, or this deck itself. */
export type DeviceRequest = (request: TunnelRequest) => Promise<TunnelResponse>;

export const viaLink =
  (link: () => Promise<Mux>): DeviceRequest =>
  async (request) =>
    tunnelRequest(await link(), request);

/** This deck, through the same loopback door paired decks use (same rules, same token). */
export const viaSelf =
  (target: ServeTarget): DeviceRequest =>
  async (request) => {
    const served = await target.http(request, new AbortController().signal);
    return {
      status: served.status,
      headers: served.headers,
      body: Readable.from(served.body ?? []),
    };
  };

const text = async (body: Readable): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks).toString('utf8');
};

const parse = (raw: string): unknown => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // not JSON (an HTML error page)
  }
};

/** The JSON of a response, or its error as this deck's own (a 404 stays a 404). */
export async function jsonOf(response: TunnelResponse): Promise<unknown> {
  const parsed = parse(await text(response.body));
  if (response.status < 400) return parsed;
  const error = (parsed as { error?: unknown } | null)?.error;
  const message = typeof error === 'string' ? error : `The device answered ${response.status}`;
  if (response.status === 404) throw notFound(message.replace(/ not found$/, ''));
  throw new DeckError('unavailable', message);
}

/** A JSON call to a device's API. */
export function jsonCall(
  send: DeviceRequest,
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const json = body !== undefined;
  return send({
    method,
    path,
    headers: json ? { 'content-type': 'application/json' } : {},
    body: json ? Readable.from([Buffer.from(JSON.stringify(body))]) : null,
  }).then(jsonOf);
}
