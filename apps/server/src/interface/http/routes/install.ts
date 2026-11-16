import { execFile } from 'node:child_process';
import { setupSpecFor } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notFound } from '../../../domain/errors.js';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

const IdParams = z.object({ id: z.string().min(1) });
const INSTALL_TIMEOUT_MS = 5 * 60_000;

/** Downloads an agent's CLI (npm install -g) on the person's request: there is no terminal to do it in. */
export function installRoutes(app: FastifyInstance, c: Container): void {
  app.post('/api/providers/:id/install', async (request) => {
    const { id } = parseWith(IdParams, request.params);
    const plugin = c.providers.get(id)?.setup;
    if (plugin) return { ...(await plugin.install()), status: await c.providerStatus(id) };
    const status = await c.providerStatus(id);
    const spec = setupSpecFor(status.setupId ?? id);
    if (!spec?.install) throw notFound(`Installer for ${id}`);
    const [command = 'npm', ...args] = spec.install;
    // The command and arguments come from the fixed table of installers, never from the request.
    const output = await new Promise<{ ok: boolean; output: string }>((resolve) => {
      execFile(
        command,
        args,
        { timeout: INSTALL_TIMEOUT_MS, shell: process.platform === 'win32', maxBuffer: 4 << 20 },
        (error, stdout, stderr) =>
          resolve({ ok: error === null, output: `${stdout}${stderr}`.slice(-4000) }),
      );
    });
    return { ...output, status: await c.providerStatus(id) };
  });
}
