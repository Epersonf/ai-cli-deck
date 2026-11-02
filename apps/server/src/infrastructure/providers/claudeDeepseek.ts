import { invalid } from '../../domain/errors.js';
import { createClaudeLike } from './claudeLike.js';

export const claudeDeepseek = createClaudeLike(
  'claude-deepseek',
  'Claude Code (DeepSeek)',
  (ctx) => {
    const key = ctx.secrets.deepseekApiKey;
    if (key === null)
      throw invalid('No DeepSeek API key saved yet. Run: clideck setup claude-deepseek');
    return {
      ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
      ANTHROPIC_AUTH_TOKEN: key,
      ANTHROPIC_MODEL: 'deepseek-chat',
      ANTHROPIC_SMALL_FAST_MODEL: 'deepseek-chat',
    };
  },
);
