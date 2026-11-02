import { SETUP_SPECS, setupSpecFor } from '@deck/shared';
import { EnvSchema } from '../infrastructure/config/schema.js';
import { resolvePaths } from '../infrastructure/config/loadConfig.js';
import { saveApiKey } from './apiKeyStore.js';
import { setupProvider } from './setup.js';
import { terminalIo } from './terminalIo.js';

/** `clideck setup [provider]`: runs the interactive install/sign-in flow in this terminal. */
export async function runSetup(providerId: string | null): Promise<string> {
  const ids = SETUP_SPECS.map((spec) => spec.id).join(', ');
  const spec = providerId === null ? undefined : setupSpecFor(providerId);
  if (!spec) {
    const prefix = providerId === null ? '' : `No setup flow for "${providerId}". `;
    return `${prefix}Usage: clideck setup <provider>   (providers: ${ids})`;
  }
  const { configDir } = resolvePaths(EnvSchema.parse(process.env));
  await setupProvider(spec, {
    io: terminalIo,
    saveKey: (name, key) => saveApiKey(configDir, name, key),
  });
  await terminalIo.ask('\nPress Enter to close this session... ');
  return '';
}
