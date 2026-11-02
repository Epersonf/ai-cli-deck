import { TOKEN_HEADER } from '@deck/shared';
import { z } from 'zod';
import { getToken } from './token';
import { notifyUnauthorized } from './unauthorized';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    const message = (body as { error?: unknown }).error;
    return typeof message === 'string' ? message : response.statusText;
  } catch {
    return response.statusText;
  }
}

/** Sends a request and validates the response against `schema`. */
export async function request<T>(
  schema: z.ZodType<T>,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token !== null) headers[TOKEN_HEADER] = token;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  const response = await fetch(path, init);
  if (response.status === 401 && path !== '/api/login') notifyUnauthorized();
  if (!response.ok) throw new ApiError(response.status, await errorMessage(response));
  if (response.status === 204) return schema.parse(undefined);
  return schema.parse(await response.json());
}

export function withToken(path: string): string {
  const token = getToken();
  if (token === null) return path;
  return `${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

const UploadedSchema = z.object({ path: z.string() });

/** MIME type to a short file extension for pasted images. */
export function extensionOf(mime: string): string {
  const sub = mime.split('/')[1]?.split('+')[0]?.toLowerCase() ?? '';
  return /^[a-z0-9]{1,5}$/.test(sub) ? (sub === 'jpeg' ? 'jpg' : sub) : 'png';
}

/** POSTs a file/blob as the raw body (streamed by the server) and returns where it was saved. */
export async function sendRaw(path: string, body: Blob): Promise<{ path: string }> {
  const headers: Record<string, string> = { 'content-type': 'application/octet-stream' };
  const token = getToken();
  if (token !== null) headers[TOKEN_HEADER] = token;
  const response = await fetch(path, { method: 'POST', headers, body });
  if (response.status === 401) notifyUnauthorized();
  if (!response.ok) throw new ApiError(response.status, await errorMessage(response));
  return UploadedSchema.parse(await response.json());
}
