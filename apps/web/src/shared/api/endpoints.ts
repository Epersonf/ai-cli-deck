import {
  ApprovalRequestSchema,
  AuthStatusSchema,
  LoginResponseSchema,
  FileContentSchema,
  GitStatusSchema,
  ProfileSchema,
  ProviderInfoSchema,
  PublicConfigSchema,
  SessionSchema,
  TreeResponseSchema,
  type ApprovalDecision,
  type CreateProfileBody,
  type CreateSessionBody,
} from '@deck/shared';
import { z } from 'zod';
import { extensionOf, request, sendRaw, withToken } from './client';

const enc = encodeURIComponent;
const session = (id: string): string => `/api/sessions/${enc(id)}`;

export const api = {
  authStatus: () => request(AuthStatusSchema, 'GET', '/api/auth'),
  login: (password: string) => request(LoginResponseSchema, 'POST', '/api/login', { password }),
  changePassword: (current: string | null, next: string | null) =>
    request(LoginResponseSchema, 'PUT', '/api/password', { current, next }),
  config: () => request(PublicConfigSchema, 'GET', '/api/config'),
  providers: () => request(z.array(ProviderInfoSchema), 'GET', '/api/providers'),
  sessions: () => request(z.array(SessionSchema), 'GET', '/api/sessions'),
  createSession: (body: Omit<CreateSessionBody, never>) =>
    request(SessionSchema, 'POST', '/api/sessions', body),
  renameSession: (id: string, name: string | null) =>
    request(SessionSchema, 'PATCH', session(id), { name }),
  createProfile: (body: CreateProfileBody) => request(ProfileSchema, 'POST', '/api/profiles', body),
  deleteProfile: (id: string) =>
    request(z.object({ ended: z.number() }), 'DELETE', `/api/profiles/${enc(id)}`),
  renameProfile: (id: string, label: string) =>
    request(ProfileSchema, 'PATCH', `/api/profiles/${enc(id)}`, { label }),
  deleteSession: (id: string) => request(z.void(), 'DELETE', session(id)),
  setPreview: (id: string, url: string) =>
    request(z.object({ url: z.string() }), 'PUT', `${session(id)}/preview`, { url }),
  tree: (id: string, path: string, showIgnored: boolean) =>
    request(
      TreeResponseSchema,
      'GET',
      `${session(id)}/tree?path=${enc(path)}&showIgnored=${showIgnored}`,
    ),
  file: (id: string, path: string) =>
    request(FileContentSchema, 'GET', `${session(id)}/file?path=${enc(path)}`),
  git: (id: string) => request(GitStatusSchema, 'GET', `${session(id)}/git`),
  upload: (id: string, dir: string, file: File) =>
    sendRaw(`${session(id)}/upload?dir=${enc(dir)}&name=${enc(file.name)}`, file),
  paste: (id: string, blob: Blob) =>
    sendRaw(`${session(id)}/paste?ext=${enc(extensionOf(blob.type))}`, blob),
  approvals: () => request(z.array(ApprovalRequestSchema), 'GET', '/api/approvals?status=pending'),
  decide: (id: string, decision: ApprovalDecision) =>
    request(ApprovalRequestSchema, 'POST', `/api/approvals/${enc(id)}/decision`, { decision }),
};

/** URL of a session file served raw (images, audio, video, pdf). */
export const rawUrl = (id: string, path: string): string =>
  withToken(`${session(id)}/raw?path=${enc(path)}`);
