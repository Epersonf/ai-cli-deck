/** Expands a leading `~` to the home directory (works with / and \ separators). */
export function resolveCwd(input: string, home: string): string {
  const text = input.trim();
  if (text === '~') return home;
  if (/^~[\\/]/.test(text)) return home.replace(/[\\/]+$/, '') + text.slice(1);
  return text;
}
