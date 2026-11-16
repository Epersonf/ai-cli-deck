import { query } from '@anthropic-ai/claude-agent-sdk';
import type { QueryFn, QueryLike } from './claudeDriver.js';

/** The real SDK `query`, typed down to what the driver needs. */
export const sdkQuery: QueryFn = ({ prompt, options }) =>
  query({ prompt: prompt as never, options: options as never }) as unknown as QueryLike;
