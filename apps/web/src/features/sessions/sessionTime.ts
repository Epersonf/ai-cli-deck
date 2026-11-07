/** "14:32" for today, "07/11 14:32" for older sessions: a tiny stamp for the list rows. */
export function sessionTime(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const clock = at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (at.toDateString() === now.toDateString()) return clock;
  const day = at.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  return `${day} ${clock}`;
}
