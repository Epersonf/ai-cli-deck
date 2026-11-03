import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { AppConfigSchema, EnvSchema, type AppConfig, type Env } from './schema.js';

export interface Paths {
  configDir: string;
  stateDir: string;
  staticDir: string | null;
}

export function resolvePaths(env: Env): Paths {
  const home = homedir();
  return {
    configDir: env.DECK_CONFIG_DIR ?? join(home, '.config', 'ai-cli-deck'),
    stateDir: env.DECK_STATE_DIR ?? join(home, '.local', 'state', 'ai-cli-deck'),
    staticDir: env.DECK_STATIC_DIR ?? null,
  };
}

export function mergeConfig(file: unknown, env: Env): AppConfig {
  const parsed = AppConfigSchema.parse(file ?? {});
  return {
    ...parsed,
    host: env.DECK_HOST ?? parsed.host,
    port: env.DECK_PORT ?? parsed.port,
    password: env.DECK_PASSWORD ?? parsed.password,
    defaultCwd: env.DECK_ROOT ?? parsed.defaultCwd,
  };
}

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

export async function loadConfig(
  processEnv: NodeJS.ProcessEnv,
): Promise<{ config: AppConfig; paths: Paths }> {
  const env = EnvSchema.parse(processEnv);
  const paths = resolvePaths(env);
  const file = await readJson(join(paths.configDir, 'config.json'));
  return { config: mergeConfig(file, env), paths };
}
