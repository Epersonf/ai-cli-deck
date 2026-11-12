import { SessionSchema, type ForkSessionBody } from '@deck/shared';
import { request } from './client';

const session = (id: string): string => `/api/sessions/${encodeURIComponent(id)}`;

/** Conversations: forking or moving them between AIs. */
export const chatApi = {
  fork: (id: string, body: ForkSessionBody) =>
    request(SessionSchema, 'POST', `${session(id)}/fork`, body),
};
