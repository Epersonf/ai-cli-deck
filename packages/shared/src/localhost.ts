const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Returns a normalized URL string when `input` is an http(s) URL on localhost, else null. */
export function parseLocalUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username !== '' || url.password !== '') return null;
  if (!LOCAL_HOSTS.has(url.hostname)) return null;
  return url.toString();
}

export function isLocalUrl(input: string): boolean {
  return parseLocalUrl(input) !== null;
}
