import { DeckError } from '../../domain/errors.js';

export interface TextResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

const text = (value: string, isError?: boolean): TextResult => ({
  content: [{ type: 'text', text: value }],
  ...(isError ? { isError } : {}),
});

/** A tool's own errors become a readable error result; anything else is a bug and propagates. */
function failure(error: unknown): TextResult {
  if (!(error instanceof DeckError)) throw error;
  return text(error.message, true);
}

export async function runAsync(action: () => Promise<unknown>): Promise<TextResult> {
  try {
    return text(JSON.stringify(await action()));
  } catch (error) {
    return failure(error);
  }
}

export function run(action: () => unknown): TextResult {
  try {
    return text(JSON.stringify(action()));
  } catch (error) {
    return failure(error);
  }
}
