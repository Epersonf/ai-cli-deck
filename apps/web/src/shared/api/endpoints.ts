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
import { extensionOf, request, sendRaw, withToken } from './client';

const BrowserStatusSchema = z.object({
  installed: z.boolean(),
  installing: z.boolean(),
  error: z.string().nullable(),
});
const PageInfoSchema = z.object({ url: z.string(), title: z.string() });

export type BrowserStatus = z.infer<typeof BrowserStatusSchema>;
export type PageInfo = z.infer<typeof PageInfoSchema>;
export type BrowserInput =
  | { kind: 'click'; x: number; y: number }
  | { kind: 'type'; text: string }
  | { kind: 'key'; key: string }
  | { kind: 'scroll'; dy: number }
  | { kind: 'back' | 'forward' | 'reload' };

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
  /** A plain shell in a folder of this session, opened as a sub-terminal. */
  openTerminal: (id: string, path: string) =>
    request(SessionSchema, 'POST', `${session(id)}/terminal`, { path }),
  renameSession: (id: string, name: string | null) =>
    request(SessionSchema, 'PATCH', session(id), { name }),
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
  notifyIdle: (sessionId: string, on: boolean) =>
    request(
      z.object({ task: TaskSchema.nullable() }),
      'POST',
      `${session(sessionId)}/notify-idle`,
      {
        on,
      },
    ),
  createProfile: (body: CreateProfileBody) => request(ProfileSchema, 'POST', '/api/profiles', body),
  deleteProfile: (id: string, force = false) =>
    request(
      z.object({ ended: z.number() }),
      'DELETE',
      `/api/profiles/${enc(id)}${force ? '?force=1' : ''}`,
    ),
  renameProfile: (id: string, label: string) =>
    request(ProfileSchema, 'PATCH', `/api/profiles/${enc(id)}`, { label }),
  deleteSession: (id: string) => request(z.void(), 'DELETE', session(id)),
  setPreview: (id: string, url: string) =>
    request(z.object({ url: z.string() }), 'PUT', `${session(id)}/preview`, { url }),
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
