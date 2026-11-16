import type { ModelListing } from '../../domain/provider.js';

const TIMEOUT_MS = 6_000;

export type Fetcher = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/** `https://host/anthropic` -> `https://host/anthropic/v1/models` (a base that already ends in /v1 is kept). */
export function modelsUrl(base: string): string {
  const root = base.replace(/\/+$/, '');
  return /\/v\d+$/.test(root) ? `${root}/models` : `${root}/v1/models`;
}

function idsOf(body: unknown): Array<{ id: string; label: string }> {
  const data = (body as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  return data.flatMap((row: { id?: unknown; display_name?: unknown } | null) =>
    typeof row?.id === 'string' && row.id
      ? [{ id: row.id, label: typeof row.display_name === 'string' ? row.display_name : row.id }]
      : [],
  );
}

/**
 * The models an Anthropic-compatible endpoint lists (`GET {base}/v1/models` with the profile's key). When it
 * cannot be asked, the model the profile is set to use is the only choice; with neither there is none.
 */
export async function endpointModels(
  env: Record<string, string>,
  fetcher: Fetcher = fetch as unknown as Fetcher,
): Promise<ModelListing> {
  const configured = env['ANTHROPIC_MODEL'] || null;
  const fallback: ModelListing = {
    choices: configured ? [{ id: configured, label: configured, description: null }] : [],
    current: configured,
  };
  const base = env['ANTHROPIC_BASE_URL'];
  if (!base) return fallback;
  const key = env['ANTHROPIC_AUTH_TOKEN'] || env['ANTHROPIC_API_KEY'] || '';
  const headers: Record<string, string> = { 'anthropic-version': '2023-06-01' };
  if (key) {
    headers['x-api-key'] = key;
    headers['authorization'] = `Bearer ${key}`;
  }
  try {
    const res = await fetcher(modelsUrl(base), {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return fallback;
    const found = idsOf(await res.json());
    if (found.length === 0) return fallback;
    return { choices: found.map((m) => ({ ...m, description: null })), current: configured };
  } catch {
    return fallback;
  }
}
