/**
 * Ctrl/Cmd+Shift+C always copies the selection. Plain Ctrl/Cmd+C copies only while text is selected;
 * with nothing selected it stays ^C for the program.
 */
export function isCopyShortcut(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>,
  hasSelection: boolean,
): boolean {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return false;
  if (event.key.toLowerCase() !== 'c') return false;
  return event.shiftKey || hasSelection;
}
