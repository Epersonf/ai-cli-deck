/** CLI reset clocks are usable only when an explicit IANA zone is present. */
export function retryClock(text: string, now: number): number {
  const match =
    /(?:resets?(?: at)?|try again at)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*\(([A-Za-z_+\-/]+)\)/i.exec(
      text,
    );
  if (!match) return NaN;
  const zone = match[4];
  if (!zone) return NaN;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const period = match[3]?.toLowerCase();
  if (minute > 59 || (period ? hour < 1 || hour > 12 : hour > 23)) return NaN;
  const targetHour = period ? (hour % 12) + (period === 'pm' ? 12 : 0) : hour;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
    const wall = (at: number): number => {
      const p = Object.fromEntries(
        formatter.formatToParts(at).map((part) => [part.type, Number(part.value)]),
      );
      return Date.UTC(
        p['year'] ?? 0,
        (p['month'] ?? 1) - 1,
        p['day'] ?? 1,
        p['hour'] ?? 0,
        p['minute'] ?? 0,
      );
    };
    const date = new Date(wall(now));
    for (let day = 0; day < 2; day++) {
      const target = Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() + day,
        targetHour,
        minute,
      );
      const candidates: number[] = [];
      // Different seeds find both occurrences of an ambiguous clock when daylight saving ends.
      for (const seed of [-12, 0, 12]) {
        let candidate = target + seed * 3_600_000;
        for (let step = 0; step < 4; step++) candidate += target - wall(candidate);
        if (wall(candidate) === target && candidate > now) candidates.push(candidate);
      }
      if (candidates.length) return Math.min(...candidates);
    }
  } catch {
    /* Unknown zone; the UI will explicitly say the schedule is estimated. */
  }
  return NaN;
}
