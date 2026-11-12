import { z } from 'zod';
import { request } from './client';

export const modelApi = {
  /** The model new chats of a profile start with; null returns to the agent's own default. */
  setDefault: (provider: string, model: string | null) =>
    request(z.void(), 'PUT', `/api/providers/${encodeURIComponent(provider)}/default-model`, {
      model,
    }),
};
