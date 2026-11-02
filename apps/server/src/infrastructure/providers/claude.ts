import { createClaudeLike } from './claudeLike.js';

export const claude = createClaudeLike('claude', 'Claude Code', (ctx) =>
  ctx.secrets.anthropicApiKey === null ? {} : { ANTHROPIC_API_KEY: ctx.secrets.anthropicApiKey },
);
