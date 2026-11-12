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

/** A named, clean agent made from a template (`base` is the template's id). */
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
  /** The API key for a template that asks for one; saved in the profile's own folder, never returned. */
  secret: z.string().trim().max(500).optional(),
});
/** What a client sends: `values` may be left out. */
export type CreateProfileBody = z.input<typeof CreateProfileBodySchema>;

/** Replaces the API key of a profile. */
export const SetProfileSecretBodySchema = z.object({ secret: z.string().trim().min(1).max(500) });

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

/**
 * A profile carried to another device: its record, its template when it is not built in, and its CLI
 * config folder (sign-in, API key, settings; chats only when asked), file by file in base64.
 */
export const ProfileBundleSchema = z.object({
  profile: ProfileSchema,
  template: z.string().nullable(),
  files: z.array(z.object({ path: z.string().min(1).max(500), data: z.string() })).max(5000),
});
export type ProfileBundle = z.infer<typeof ProfileBundleSchema>;
