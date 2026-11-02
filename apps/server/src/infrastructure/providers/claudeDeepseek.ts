import { invalid } from '../../domain/errors.js';
import { createClaudeLike } from './claudeLike.js';

export const claudeDeepseek = createClaudeLike(
  'claude-deepseek',
  'Claude Code (DeepSeek)',
  (ctx) => {
    const key = ctx.secrets.deepseekApiKey;
    if (key === null) throw invalid('Set "deepseekApiKey" in ~/.config/ai-cli-deck/config.json');
    return {
      ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
      ANTHROPIC_AUTH_TOKEN: key,
      ANTHROPIC_MODEL: 'deepseek-chat',
      ANTHROPIC_SMALL_FAST_MODEL: 'deepseek-chat',
    };
  },
);
