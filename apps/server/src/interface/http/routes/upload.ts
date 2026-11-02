import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { invalid, notFound } from '../../../domain/errors.js';
import { resolveInside } from '../../../infrastructure/fs/pathGuard.js';
import type { Container } from '../../container.js';
import { parseWith } from '../errors.js';

export const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;
const IdParams = z.object({ id: z.string().min(1) });
const UploadQuery = z.object({ dir: z.string().default(''), name: z.string().min(1).max(255) });
const PasteQuery = z.object({
  ext: z
    .string()
    .regex(/^[a-z0-9]{1,5}$/i)
    .default('png'),
});

/** A file name that cannot escape its folder: no separators, no control chars, not dot-only. */
export function safeFileName(name: string): string {
  const clean = [...basename(name.replace(/\\/g, '/'))]
    .filter((ch) => ch.charCodeAt(0) >= 32)
    .join('')

    .trim();
  if (clean === '' || clean === '.' || clean === '..') throw invalid('Invalid file name');
  return clean;
}

const exists = (path: string): Promise<boolean> =>
  stat(path).then(
    () => true,
    () => false,
  );

/** "a.png" -> "a (1).png" until the name is free, so an upload never overwrites a file. */
async function freeName(dir: string, name: string): Promise<string> {
  const ext = extname(name);
  const stem = name.slice(0, name.length - ext.length);
  let candidate = name;
  for (let n = 1; await exists(join(dir, candidate)); n += 1) candidate = `${stem} (${n})${ext}`;
  return candidate;
}

async function save(source: NodeJS.ReadableStream, target: string): Promise<number> {
  let bytes = 0;
  const limit = new Transform({
    transform(chunk: Buffer, _enc, done) {
      bytes += chunk.length;
      done(bytes > MAX_UPLOAD_BYTES ? invalid('File is too large') : null, chunk);
    },
  });
  await pipeline(source, limit, createWriteStream(target, { flags: 'wx' }));
  return bytes;
}

/** Raw-body uploads: into the session folder, and image pastes into a scratch folder. */
export function uploadRoutes(app: FastifyInstance, c: Container): void {
  app.addContentTypeParser('application/octet-stream', (_request, payload, done) =>
    done(null, payload),
  );

  const sessionOf = (id: string) => {
    const session = c.sessions.get(id);
    if (!session) throw notFound(`Session ${id}`);
    return session;
  };

  app.post('/api/sessions/:id/upload', async (request) => {
    const { id } = parseWith(IdParams, request.params);
    const { dir, name } = parseWith(UploadQuery, request.query);
    const folder = await resolveInside(sessionOf(id).cwd, dir);
    const final = await freeName(folder, safeFileName(name));
    await save(request.body as NodeJS.ReadableStream, join(folder, final));
    return { path: dir === '' ? final : `${dir.replace(/\/+$/, '')}/${final}` };
  });

  // A pasted screenshot has no folder of its own: keep it outside the project, give the path back.
  app.post('/api/sessions/:id/paste', async (request) => {
    const { id } = parseWith(IdParams, request.params);
    const { ext } = parseWith(PasteQuery, request.query);
    sessionOf(id);
    const folder = join(tmpdir(), 'deck-paste', id);
    await mkdir(folder, { recursive: true });
    const target = join(folder, `paste-${Date.now()}.${ext.toLowerCase()}`);
    await save(request.body as NodeJS.ReadableStream, target);
    return { path: target };
  });
}
