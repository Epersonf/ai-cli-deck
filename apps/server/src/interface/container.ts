import type { ApprovalService } from '../application/ApprovalService.js';
import type { PreviewService } from '../application/PreviewService.js';
import type { SessionManager } from '../application/SessionManager.js';
import type { WorkspaceService } from '../application/WorkspaceService.js';
import type { EventBus } from '../domain/events.js';
import type { ProviderRegistry } from '../domain/provider.js';

export interface SecurityOptions {
  bindHost: string;
  token: string | null;
  allowedOrigins: readonly string[];
}

export interface PublicConfig {
  defaultCwd: string | null;
  extraKeys: string[] | null;
  persistent: boolean;
  tokenRequired: boolean;
}

/** Everything the transport layer needs, wired once in the composition root. */
export interface Container {
  sessions: SessionManager;
  approvals: ApprovalService;
  workspace: WorkspaceService;
  preview: PreviewService;
  providers: ProviderRegistry;
  bus: EventBus;
  publicConfig: PublicConfig;
  security: SecurityOptions;
  staticDir: string | null;
}
