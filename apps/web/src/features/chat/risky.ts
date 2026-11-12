import type { PermissionMode } from '@deck/shared';

/** Modes that run without asking: flagged with a warning strip and a dot on the folded toggle. */
export const RISKY: readonly PermissionMode[] = ['bypassPermissions', 'dontAsk'];
