/** Accepts "3000", ":3000", "localhost:3000/x" or a full URL and returns a full URL. */
export function normalizeUrl(input: string): string {
  const text = input.trim();
  if (/^\d{2,5}$/.test(text)) return `http://localhost:${text}`;
  if (/^:\d{2,5}/.test(text)) return `http://localhost${text}`;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`;
}
