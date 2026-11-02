import { z } from 'zod';

/** What a profile starts from. Always a clean terminal: no login and no key are linked. */
export const PROFILE_BASES = ['claude', 'claude-deepseek', 'codex', 'custom'] as const;
export const ProfileBaseSchema = z.enum(PROFILE_BASES);
export type ProfileBase = z.infer<typeof ProfileBaseSchema>;

export const ProfileSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  label: z.string().trim().min(1).max(60),
  base: ProfileBaseSchema,
  /** Only for the "custom" base: the program to run (empty = the default shell). */
  command: z.string().trim().default(''),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const CreateProfileBodySchema = z.object({
  label: ProfileSchema.shape.label,
  base: ProfileBaseSchema,
  command: z.string().trim().max(200).default(''),
});
export type CreateProfileBody = z.infer<typeof CreateProfileBodySchema>;

export const RenameProfileBodySchema = z.object({ label: ProfileSchema.shape.label });

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
