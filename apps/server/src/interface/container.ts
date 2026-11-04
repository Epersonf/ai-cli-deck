import type { PublicConfig } from '@deck/shared';
import type { ProfileService } from '../application/ProfileService.js';
import type { TaskService } from '../application/TaskService.js';
import type { TemplateService } from '../application/TemplateService.js';
import type { ProviderStatusInfo } from '../infrastructure/providers/status.js';
import type { ApprovalService } from '../application/ApprovalService.js';
import type { AuthService } from '../application/AuthService.js';
import type { LoginThrottle } from '../application/LoginThrottle.js';
import type { HandoffService } from '../application/HandoffService.js';
import type { BrowserService } from '../application/BrowserService.js';
import type { PreviewService } from '../application/PreviewService.js';
import type { SessionManager } from '../application/SessionManager.js';
import type { WorkspaceService } from '../application/WorkspaceService.js';
import type { EventBus } from '../domain/events.js';
import type { PhonePort } from '../domain/ports.js';
import type { ProviderRegistry } from '../domain/provider.js';

export interface SecurityOptions {
  bindHost: string;
  isValidToken(provided: string | undefined): boolean;
  allowedOrigins: readonly string[];
}

/** Everything the transport layer needs, wired once in the composition root. */
export interface Container {
  sessions: SessionManager;
  handoffs: HandoffService;
  /** Null unless the Android app enabled phone access. */
  phone: PhonePort | null;
  approvals: ApprovalService;
  workspace: WorkspaceService;
  preview: PreviewService;
  browser: BrowserService;
  providers: ProviderRegistry;
  bus: EventBus;
  publicConfig: PublicConfig;
  providerStatus(id: string): Promise<ProviderStatusInfo>;
  profiles: ProfileService;
  templates: TemplateService;
  tasks: TaskService;
  security: SecurityOptions;
  auth: AuthService;
  throttle: LoginThrottle;
  staticDir: string | null;
}
