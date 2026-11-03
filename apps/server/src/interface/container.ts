import type { PublicConfig } from '@deck/shared';
import type { ProfileService } from '../application/ProfileService.js';
import type { ProviderStatusInfo } from '../infrastructure/providers/status.js';
import type { ApprovalService } from '../application/ApprovalService.js';
import type { AuthService } from '../application/AuthService.js';
import type { LoginThrottle } from '../application/LoginThrottle.js';
import type { BrowserService } from '../application/BrowserService.js';
import type { PreviewService } from '../application/PreviewService.js';
import type { SessionManager } from '../application/SessionManager.js';
import type { WorkspaceService } from '../application/WorkspaceService.js';
import type { EventBus } from '../domain/events.js';
import type { ProviderRegistry } from '../domain/provider.js';

export interface SecurityOptions {
  bindHost: string;
  isValidToken(provided: string | undefined): boolean;
  allowedOrigins: readonly string[];
}

/** Everything the transport layer needs, wired once in the composition root. */
export interface Container {
  sessions: SessionManager;
  approvals: ApprovalService;
  workspace: WorkspaceService;
  preview: PreviewService;
  browser: BrowserService;
  providers: ProviderRegistry;
  bus: EventBus;
  publicConfig: PublicConfig;
  providerStatus(id: string): Promise<ProviderStatusInfo>;
  profiles: ProfileService;
  security: SecurityOptions;
  auth: AuthService;
  throttle: LoginThrottle;
  staticDir: string | null;
}
