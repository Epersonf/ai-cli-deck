import { z } from 'zod';

/** An http(s) URL, the only kind an API endpoint can be. */
export const isHttpUrl = (text: string): boolean => {
  try {
    const { protocol } = new URL(text);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
};

/** A named, clean terminal made from a template (`base` is the template's id). */
export const ProfileSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  label: z.string().trim().min(1).max(60),
  base: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  /** What was typed for the template's fields (e.g. the API base URL). */
  values: z.record(z.string(), z.string().max(300)).default({}),
});
export type Profile = z.output<typeof ProfileSchema>;

export const CreateProfileBodySchema = z.object({
  label: z.string().trim().min(1).max(60),
  base: z.string().min(1).max(40),
  values: z.record(z.string(), z.string().max(300)).default({}),
});
/** What a client sends: `values` may be left out. */
export type CreateProfileBody = z.input<typeof CreateProfileBodySchema>;

export const RenameProfileBodySchema = z.object({ label: z.string().trim().min(1).max(60) });

/** URL-safe id from a display name, made unique among `taken`. */
export function profileIdFor(label: string, taken: readonly string[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'profile';
  let id = base;
  for (let n = 2; taken.includes(id); n += 1) id = `${base}-${n}`;
  return id;
}
