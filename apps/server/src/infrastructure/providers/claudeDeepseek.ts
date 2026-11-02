import { createClaudeLike } from './claudeLike.js';

export const DEEPSEEK_ENV = {
  ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
  ANTHROPIC_MODEL: 'deepseek-chat',
  ANTHROPIC_SMALL_FAST_MODEL: 'deepseek-chat',
} as const;

/** Claude Code pointed at DeepSeek. The key is yours to set inside the terminal (the deck holds none). */
export const claudeDeepseek = createClaudeLike('claude-deepseek', 'Claude Code (DeepSeek)', () => ({
  ...DEEPSEEK_ENV,
}));
