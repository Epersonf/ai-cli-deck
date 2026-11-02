import { DEFAULT_PORT_RANGE, DEFAULT_SERVER_PORT } from '@deck/shared';
import { z } from 'zod';

export const AppConfigSchema = z.object({
  host: z.string().default('127.0.0.1'),
  port: z.number().int().min(1).max(65535).default(DEFAULT_SERVER_PORT),
  portRange: z
    .object({ min: z.number().int(), max: z.number().int() })
    .default({ ...DEFAULT_PORT_RANGE }),
  deepseekApiKey: z.string().min(1).nullable().default(null),
  allowedOrigins: z.array(z.string()).default([]),
  defaultCwd: z.string().nullable().default(null),
  extraKeys: z.array(z.string()).nullable().default(null),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;

export const EnvSchema = z.object({
  DECK_HOST: z.string().optional(),
  DECK_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  DECK_CONFIG_DIR: z.string().optional(),
  DECK_STATE_DIR: z.string().optional(),
  DECK_STATIC_DIR: z.string().optional(),
});
export type Env = z.infer<typeof EnvSchema>;
