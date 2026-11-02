const UTF8 = /utf-?8/i;

/** Child CLIs and tmux print accents as "_" unless the locale is UTF-8, so default it. */
export function utf8Locale(
  env: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const current = env['LC_ALL'] ?? env['LANG'] ?? '';
  if (UTF8.test(current)) return {};
  return { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' };
}
