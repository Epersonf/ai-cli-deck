import { z } from 'zod';
import { request } from './client';

export const installProvider = (id: string) =>
  request(
    z.object({ ok: z.boolean(), output: z.string() }),
    'POST',
    `/api/providers/${encodeURIComponent(id)}/install`,
    {},
  );
