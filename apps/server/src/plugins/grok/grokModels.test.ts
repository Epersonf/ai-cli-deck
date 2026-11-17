import { describe, expect, it } from 'vitest';
import { grokSessionModels, parseGrokModels } from './grokModels.js';

describe('Grok Build model catalog', () => {
  it('reads the default and the other models without hardcoding any', () => {
    const text =
      'You are not authenticated.\n\nDefault model: grok-4.6\n\nAvailable models:\n  * grok-4.6 (default)\n  - grok-4.5\n';
    expect(parseGrokModels(text)).toEqual({
      choices: [
        { id: 'grok-4.6', label: 'grok-4.6', description: null },
        { id: 'grok-4.5', label: 'grok-4.5', description: null },
      ],
      current: 'grok-4.6',
    });
    expect(parseGrokModels('Authentication required')).toEqual({ choices: [], current: null });
  });

  it('reads names and descriptions from the session the account gets', () => {
    expect(
      grokSessionModels({
        models: {
          currentModelId: 'grok-4.7',
          availableModels: [{ modelId: 'grok-4.7', name: 'Grok 4.7', description: 'Newest' }],
        },
      }),
    ).toEqual({
      choices: [{ id: 'grok-4.7', label: 'Grok 4.7', description: 'Newest' }],
      current: 'grok-4.7',
    });
  });
});
