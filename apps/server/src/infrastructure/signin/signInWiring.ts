import type { ProfileService } from '../../application/ProfileService.js';
import { SignInService } from '../../application/SignInService.js';
import type { ProviderRegistry } from '../../domain/provider.js';

/** The provider plugin supplies authentication; the service owns the common flow state. */
export const createSignIn = (
  providers: ProviderRegistry,
  profiles: ProfileService,
): SignInService => new SignInService({ providers, profiles });
