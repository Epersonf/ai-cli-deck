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
  TaskLogSchema,
  TaskSchema,
  TemplateInfoSchema,
  TreeResponseSchema,
  type ApprovalDecision,
  type CreateProfileBody,
  type CreateSessionBody,
} from '@deck/shared';
import { z } from 'zod';
import {
  BrowserStatusSchema,
  PageInfoSchema,
  type BrowserInput,
  type BrowserStatus,
  type PageInfo,
} from './browserTypes';
import { extensionOf, request, sendRaw, withToken } from './client';

export type { BrowserInput, BrowserStatus, PageInfo };
type CreateSessionBodyInput = Omit<CreateSessionBody, 'chatId'> & { chatId?: string | null };

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
  createSession: (body: CreateSessionBodyInput) =>
    request(SessionSchema, 'POST', '/api/sessions', body),
  openSide: (id: string) => request(SessionSchema, 'POST', `${session(id)}/side`, {}),
  renameSession: (id: string, name: string | null) =>
    request(SessionSchema, 'PATCH', session(id), { name }),
  setSessionFolder: (id: string, path: string) =>
    request(SessionSchema, 'PUT', `${session(id)}/cwd`, { path }),
  templates: () => request(z.array(TemplateInfoSchema), 'GET', '/api/templates'),
  templateSkeleton: () =>
    request(z.object({ text: z.string() }), 'GET', '/api/templates/skeleton').then((r) => r.text),
  exportTemplate: (id: string) =>
    request(
      z.object({ text: z.string() }),
      'GET',
      `/api/templates/${encodeURIComponent(id)}/export`,
    ).then((r) => r.text),
  importTemplate: (text: string) => request(TemplateInfoSchema, 'POST', '/api/templates', { text }),
  removeTemplate: (id: string) =>
    request(z.void(), 'DELETE', `/api/templates/${encodeURIComponent(id)}`),
  chatTitles: () => request(z.record(z.string(), z.string()), 'GET', '/api/chats/titles'),
  tasks: () => request(z.array(TaskSchema), 'GET', '/api/tasks'),
  taskLog: (id: string) =>
    request(TaskLogSchema, 'GET', `/api/tasks/${encodeURIComponent(id)}/log`).then((r) => r.text),
  removeTask: (id: string) => request(z.void(), 'DELETE', `/api/tasks/${encodeURIComponent(id)}`),
  createProfile: (body: CreateProfileBody) => request(ProfileSchema, 'POST', '/api/profiles', body),
  deleteProfile: (id: string, force = false) =>
    request(
      z.object({ ended: z.number() }),
      'DELETE',
      `/api/profiles/${enc(id)}${force ? '?force=1' : ''}`,
    ),
  /** Replaces the API key of a profile (kept in its own folder, never sent back). */
  setProfileSecret: (id: string, secret: string) =>
    request(z.void(), 'PUT', `/api/profiles/${enc(id)}/secret`, { secret }),
  renameProfile: (id: string, label: string) =>
    request(ProfileSchema, 'PATCH', `/api/profiles/${enc(id)}`, { label }),
  deleteSession: (id: string) => request(z.void(), 'DELETE', session(id)),
  browserTabs: (id: string) =>
    request(
      z.object({ tabs: z.array(z.number()).nullable() }),
      'GET',
      `${session(id)}/browser-tabs`,
    ),
  setBrowserTabs: (id: string, tabs: number[]) =>
    request(z.object({ tabs: z.array(z.number()) }), 'PUT', `${session(id)}/browser-tabs`, {
      tabs,
    }),
  tree: (id: string, path: string, show: { hidden: boolean; ignored: boolean }) =>
    request(
      TreeResponseSchema,
      'GET',
      `${session(id)}/tree?path=${enc(path)}&hidden=${show.hidden}&ignored=${show.ignored}`,
    ),
  file: (id: string, path: string) =>
    request(FileContentSchema, 'GET', `${session(id)}/file?path=${enc(path)}`),
  deleteEntry: (id: string, path: string) =>
    request(z.void(), 'DELETE', `${session(id)}/file?path=${enc(path)}`),
  git: (id: string) => request(GitStatusSchema, 'GET', `${session(id)}/git`),
  upload: (id: string, dir: string, file: File) =>
    sendRaw(`${session(id)}/upload?dir=${enc(dir)}&name=${enc(file.name)}`, file),
  paste: (id: string, blob: Blob) =>
    sendRaw(`${session(id)}/paste?ext=${enc(extensionOf(blob.type))}`, blob),
  browserStatus: () => request(BrowserStatusSchema, 'GET', '/api/browser'),
  browserInstall: () => request(BrowserStatusSchema, 'POST', '/api/browser/install'),
  browserState: (id: string) => request(PageInfoSchema, 'GET', `${session(id)}/browser`),
  browserClose: (id: string) =>
    request(z.object({ ok: z.boolean() }), 'DELETE', `${session(id)}/browser`),
  browserNavigate: (id: string, url: string) =>
    request(PageInfoSchema, 'POST', `${session(id)}/browser/navigate`, { url }),
  browserInput: (id: string, input: BrowserInput) =>
    request(PageInfoSchema, 'POST', `${session(id)}/browser/input`, input),
  approvals: () => request(z.array(ApprovalRequestSchema), 'GET', '/api/approvals?status=pending'),
  decide: (id: string, decision: ApprovalDecision) =>
    request(ApprovalRequestSchema, 'POST', `/api/approvals/${enc(id)}/decision`, { decision }),
};

/** URL of a session file served raw (images, audio, video, pdf). */
export const rawUrl = (id: string, path: string): string =>
  withToken(`${session(id)}/raw?path=${enc(path)}`);

/** A session file as a download (saved instead of displayed). */
export const downloadUrl = (id: string, path: string): string =>
  withToken(`${session(id)}/raw?path=${enc(path)}&download=1`);

/** A session folder as a .zip download. */
export const zipUrl = (id: string, path: string): string =>
  withToken(`${session(id)}/zip?path=${enc(path)}`);

/** Current screenshot of the session's browser; `stamp` defeats caching. */
export const browserShotUrl = (id: string, stamp: number): string =>
  withToken(`${session(id)}/browser/screenshot?t=${stamp}`);
