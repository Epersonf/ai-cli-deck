import { GitDiffSchema, GitResultSchema, GitReviewSchema } from '@deck/shared';
import { z } from 'zod';
import { request } from './client';

const base = (id: string): string => `/api/sessions/${encodeURIComponent(id)}/git`;

/** The git review pane of a session. */
export const gitApi = {
  review: (id: string) => request(GitReviewSchema, 'GET', `${base(id)}/review`),
  diff: (id: string, path: string) =>
    request(GitDiffSchema, 'GET', `${base(id)}/diff?path=${encodeURIComponent(path)}`),
  discard: (id: string, path: string) => request(z.void(), 'POST', `${base(id)}/discard`, { path }),
  commit: (id: string, message: string, paths: readonly string[]) =>
    request(GitResultSchema, 'POST', `${base(id)}/commit`, { message, paths }),
  push: (id: string) => request(GitResultSchema, 'POST', `${base(id)}/push`, {}),
};
