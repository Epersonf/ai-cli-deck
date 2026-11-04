/** The process environment as plain strings: what every session inherits as its base. */
export function stringEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter((e): e is [string, string] => typeof e[1] === 'string'),
  );
}
