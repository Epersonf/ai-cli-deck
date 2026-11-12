import { DEFAULT_PEER_PORT, DEFAULT_PORT_RANGE, DEFAULT_SERVER_PORT } from '@deck/shared';
import { z } from 'zod';

export const AppConfigSchema = z.object({
  host: z.string().default('127.0.0.1'),
  port: z.number().int().min(1).max(65535).default(DEFAULT_SERVER_PORT),
  portRange: z
    .object({ min: z.number().int(), max: z.number().int() })
    .default({ ...DEFAULT_PORT_RANGE }),
  allowedOrigins: z.array(z.string()).default([]),
  defaultCwd: z.string().nullable().default(null),
  password: z.string().min(4).nullable().default(null),
  /** Port other decks pair and link on, while this deck shares itself (Settings > Devices). */
  peerPort: z.number().int().min(1).max(65535).default(DEFAULT_PEER_PORT),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;

export const EnvSchema = z.object({
  DECK_HOST: z.string().optional(),
  DECK_PASSWORD: z.string().min(4).optional(),
  /** Base folder for new sessions and the file explorer; defaults to the home directory. */
  DECK_ROOT: z.string().min(1).optional(),
  DECK_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  DECK_CONFIG_DIR: z.string().optional(),
  DECK_STATE_DIR: z.string().optional(),
  DECK_STATIC_DIR: z.string().optional(),
  DECK_PEER_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  /** The name other decks see (the Android app passes the phone's name). */
  DECK_NAME: z.string().trim().min(1).max(40).optional(),
});
export type Env = z.infer<typeof EnvSchema>;
