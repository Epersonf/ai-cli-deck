import { describe, expect, it } from 'vitest';
import { parseAntigravityModels } from './antigravityModels.js';

describe('official Antigravity model catalog', () => {
  it('reads CLI slugs and display names without hardcoding models or including headings', () => {
    const text =
      'Available models:\nMODEL  NAME\nmodel-a    Model A (High)\n\u001b[32mmodel-b\u001b[0m  Model B\nmodel-a    Model A (High)\n';
    expect(parseAntigravityModels(text)).toEqual([
      { id: 'model-a', label: 'Model A (High)', description: null },
      { id: 'model-b', label: 'Model B', description: null },
    ]);
    expect(parseAntigravityModels('Authentication required')).toEqual([]);
  });
});
