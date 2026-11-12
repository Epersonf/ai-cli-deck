import { SETUP_SPECS, setupSpecFor } from '@deck/shared';
import { setupProvider } from './setup.js';
import { terminalIo } from './terminalIo.js';

/** `clideck setup [provider]`: downloads a CLI in this terminal. */
export async function runSetup(providerId: string | null): Promise<string> {
  const ids = SETUP_SPECS.map((spec) => spec.id).join(', ');
  const spec = providerId === null ? undefined : setupSpecFor(providerId);
  if (!spec) {
    const prefix = providerId === null ? '' : `No installer for "${providerId}". `;
    return `${prefix}Usage: clideck setup <provider>   (providers: ${ids})`;
  }
  await setupProvider(spec, terminalIo);
  return '';
}
