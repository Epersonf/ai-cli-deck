import { AuthInfoSchema, FsDirsSchema, SignInFlowSchema, type SignInMethod } from '@deck/shared';
import { z } from 'zod';
import { request } from './client';

const provider = (id: string): string => `/api/providers/${encodeURIComponent(id)}`;

/** Signing in to a provider (the server runs the CLI's own login) and browsing the server's folders. */
export const signinApi = {
  auth: (id: string) => request(AuthInfoSchema, 'GET', `${provider(id)}/auth`),
  /** The login in progress or just finished; null when there is none. */
  flow: (id: string) => request(SignInFlowSchema.nullable(), 'GET', `${provider(id)}/login`),
  start: (id: string, method: SignInMethod) =>
    request(z.unknown(), 'POST', `${provider(id)}/login`, { method }),
  sendCode: (id: string, text: string) =>
    request(z.unknown(), 'POST', `${provider(id)}/login/input`, { text }),
  cancel: (id: string) => request(z.unknown(), 'DELETE', `${provider(id)}/login`),
  logout: (id: string) => request(z.unknown(), 'POST', `${provider(id)}/logout`),
  dirs: (path: string | null) =>
    request(
      FsDirsSchema,
      'GET',
      `/api/fs/dirs${path === null ? '' : `?path=${encodeURIComponent(path)}`}`,
    ),
};
