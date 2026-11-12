const isLead = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;

/** What to type so the line goes from `before` to `after`: backspaces over what changed, then the new text. */
export function textChange(before: string, after: string): string {
  let same = 0;
  const max = Math.min(before.length, after.length);
  while (same < max && before[same] === after[same]) same += 1;
  if (same > 0 && isLead(before.charCodeAt(same - 1))) same -= 1; // never split an emoji
  const removed = [...before.slice(same)].length;
  return '\x7f'.repeat(removed) + after.slice(same).replace(/\r?\n/g, '\r');
}
