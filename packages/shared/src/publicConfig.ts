import { z } from 'zod';

/** The only configuration the browser may see (never secrets). */
export const PublicConfigSchema = z.object({
  defaultCwd: z.string().nullable(),
  extraKeys: z.array(z.string()).nullable(),
  persistent: z.boolean(),
});
export type PublicConfig = z.infer<typeof PublicConfigSchema>;
