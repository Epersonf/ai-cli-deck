import { createReadStream } from 'node:fs';
import { mimeOf } from '@deck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';
import { parseRange } from '../range.js';

const IdParams = z.object({ id: z.string().min(1) });
const RawQuery = z.object({ path: z.string().min(1), download: z.enum(['1']).optional() });

/** `attachment; filename*=` header value with a UTF-8 safe name. */
export const attachment = (path: string): string =>
  `attachment; filename*=UTF-8''${encodeURIComponent(path.split('/').pop() || 'download')}`;

/** Streams a file from the session folder with Range support (audio/video seeking). */
export function rawRoutes(app: FastifyInstance, c: Container): void {
  app.get('/api/sessions/:id/raw', async (request, reply) => {
    const { id } = parseWith(IdParams, request.params);
    const { path, download } = parseWith(RawQuery, request.query);
    const target = await c.workspace.resolveFile(id, path);
    reply
      .header('content-type', mimeOf(path) ?? 'application/octet-stream')
      .header('accept-ranges', 'bytes')
      .header('x-content-type-options', 'nosniff')
      .header('content-security-policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'")
      .header('cache-control', 'no-store');
    if (download) reply.header('content-disposition', attachment(path));
    const range = parseRange(request.headers.range, target.size);
    if (range === 'invalid') {
      return reply.code(416).header('content-range', `bytes */${target.size}`).send();
    }
    if (range === null) {
      return reply.header('content-length', target.size).send(createReadStream(target.path));
    }
    return reply
      .code(206)
      .header('content-range', `bytes ${range.start}-${range.end}/${target.size}`)
      .header('content-length', range.end - range.start + 1)
      .send(createReadStream(target.path, range));
  });
}
