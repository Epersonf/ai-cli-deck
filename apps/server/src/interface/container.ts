import type { PublicConfig } from '@deck/shared';
import type { ProfileService } from '../application/ProfileService.js';
import type { TaskService } from '../application/TaskService.js';
import type { TemplateService } from '../application/TemplateService.js';
import type { ProviderStatusInfo } from '../infrastructure/providers/status.js';
import type { ApprovalService } from '../application/ApprovalService.js';
import type { AuthService } from '../application/AuthService.js';
import type { LoginThrottle } from '../application/LoginThrottle.js';
import type { ChatActions } from '../application/ChatActions.js';
import type { ChatService } from '../application/ChatService.js';
import type { BrowserService } from '../application/BrowserService.js';
import type { PreviewService } from '../application/PreviewService.js';
import type { SessionManager } from '../application/SessionManager.js';
import type { WorkspaceService } from '../application/WorkspaceService.js';
import type { GitReviewService } from '../application/GitReviewService.js';
import type { NetworkService } from '../application/NetworkService.js';
import type { PairingFlow } from '../application/PairingFlow.js';
import type { PairingRequests } from '../application/PairingRequests.js';
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
  chats: ChatService;
  chatActions: ChatActions;
  /** A folder as typed by the user (`~` expanded). */
  resolveCwd(cwd: string): string;
  /** Null unless the Android app enabled phone access. */
  phone: PhonePort | null;
  approvals: ApprovalService;
  workspace: WorkspaceService;
  gitReview: GitReviewService;
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
  /** Sharing this deck and its paired decks; `tunnel()` gives the link the `/peer/` proxy uses. */
  network: NetworkService<unknown>;
  pairing: PairingFlow;
  pairingRequests: PairingRequests;
  auth: AuthService;
  throttle: LoginThrottle;
  staticDir: string | null;
}
