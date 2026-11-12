import type { ProfileService } from '../../application/ProfileService.js';
import { SignInService } from '../../application/SignInService.js';
import type { ProviderRegistry } from '../../domain/provider.js';
import { stringEnv } from '../config/stringEnv.js';
import { CliAuth } from './CliAuth.js';

/** Signing in and out of the agents through their own CLIs. */
export const createSignIn = (
  providers: ProviderRegistry,
  profiles: ProfileService,
): SignInService => new SignInService({ providers, cli: new CliAuth(stringEnv()), profiles });
