import { z } from 'zod';

/** What a profile starts from. Always a clean terminal: no login and no key are linked. */
export const PROFILE_BASES = [
  'claude',
  'claude-endpoint',
  'claude-deepseek',
  'codex',
  'custom',
] as const;
export const ProfileBaseSchema = z.enum(PROFILE_BASES);
export type ProfileBase = z.infer<typeof ProfileBaseSchema>;

export const ProfileSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  label: z.string().trim().min(1).max(60),
  base: ProfileBaseSchema,
  /** Only for the "custom" base: the program to run (empty = the default shell). */
  command: z.string().trim().default(''),
  /** Only for "claude-endpoint": the API base URL Claude Code talks to (e.g. a company gateway). */
  baseUrl: z.string().trim().default(''),
});
export type Profile = z.infer<typeof ProfileSchema>;

/** An http(s) URL, the only kind an API endpoint can be. */
export const isHttpUrl = (text: string): boolean => {
  try {
    const { protocol } = new URL(text);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
};

export const CreateProfileBodySchema = z
  .object({
    label: ProfileSchema.shape.label,
    base: ProfileBaseSchema,
    command: z.string().trim().max(200).default(''),
    baseUrl: z.string().trim().max(300).default(''),
  })
  .superRefine((body, ctx) => {
    if (body.base === 'claude-endpoint' && !isHttpUrl(body.baseUrl))
      ctx.addIssue({
        code: 'custom',
        path: ['baseUrl'],
        message: 'Enter the API base URL (http:// or https://)',
      });
    if (body.base !== 'claude-endpoint' && body.baseUrl !== '')
      ctx.addIssue({
        code: 'custom',
        path: ['baseUrl'],
        message: 'Only the custom endpoint base takes a URL',
      });
  });
/** What a client sends: command and baseUrl may be left out (they default to empty). */
export type CreateProfileBody = z.input<typeof CreateProfileBodySchema>;

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
