import type { Session } from '@deck/shared';

const basename = (path: string): string =>
  path
    .replace(/[\\/]+$/, '')
    .split(/[\\/]/)
    .pop() || path;

export const defaultLabel = (session: Session): string =>
  `${session.provider} · ${basename(session.cwd)}`;

export const sessionLabel = (session: Session): string => session.name ?? defaultLabel(session);
