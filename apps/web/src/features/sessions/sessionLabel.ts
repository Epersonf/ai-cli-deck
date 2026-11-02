import type { ProviderInfo, Session } from '@deck/shared';

const basename = (path: string): string =>
  path
    .replace(/[\\/]+$/, '')
    .split(/[\\/]/)
    .pop() || path;

/** Name shown for a session: the user's own, else "<profile name> · <folder>". */
export function sessionLabel(session: Session, providers: readonly ProviderInfo[]): string {
  if (session.name !== null) return session.name;
  const profile = providers.find((p) => p.id === session.provider)?.label ?? session.provider;
  return `${profile} · ${basename(session.cwd)}`;
}
