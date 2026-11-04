/**
 * Ctrl/Cmd+V (with or without Shift). xterm would turn it into the control character ^V and swallow the
 * browser's paste; CLIs read ^V as "paste an image from the system clipboard" and would look at the
 * clipboard of the machine running the CLI (the phone) instead of the one in front of you.
 */
export function isPasteShortcut(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>,
): boolean {
  return (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'v';
}
