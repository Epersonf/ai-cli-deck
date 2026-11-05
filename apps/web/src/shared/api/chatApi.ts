import {
  ChatInfoSchema,
  SessionChatSchema,
  SessionSchema,
  type ForkSessionBody,
  type OpenChatBody,
  type RestartSessionBody,
} from '@deck/shared';
import { z } from 'zod';
import { request } from './client';

const session = (id: string): string => `/api/sessions/${encodeURIComponent(id)}`;

/** Conversations: continuing them, moving them between AIs, and the saved ones. */
export const chatApi = {
  /** What an ended terminal can do with its conversation. */
  info: (id: string) => request(SessionChatSchema, 'GET', `${session(id)}/chat`),
  restart: (id: string, body: RestartSessionBody) =>
    request(z.void(), 'POST', `${session(id)}/restart`, body),
  fork: (id: string, body: ForkSessionBody) =>
    request(SessionSchema, 'POST', `${session(id)}/fork`, body),
  /** A profile's saved chats in a folder, newest first. */
  list: (provider: string, cwd: string) =>
    request(
      z.array(ChatInfoSchema),
      'GET',
      `/api/chats?provider=${encodeURIComponent(provider)}&cwd=${encodeURIComponent(cwd)}`,
    ),
  open: (body: OpenChatBody) => request(SessionSchema, 'POST', '/api/chats/open', body),
};
