import { z } from 'zod';

/** The only configuration the browser may see (never secrets). */
export const PublicConfigSchema = z.object({
  defaultCwd: z.string().nullable(),
});
export type PublicConfig = z.infer<typeof PublicConfigSchema>;
