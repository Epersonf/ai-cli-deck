import { AutoCompactSchema, type AutoCompact } from '@deck/shared';

/** The setting as it is kept in the session's notes: `off`, a token count, or nothing for the default. */
export function parseAutoCompact(note: string | undefined): AutoCompact | null {
  if (!note) return null;
  const parsed = AutoCompactSchema.safeParse(note === 'off' ? note : Number(note));
  return parsed.success ? parsed.data : null;
}
