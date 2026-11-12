import { describe, expect, it } from 'vitest';
import { speakable } from './speech';

describe('speakable', () => {
  it('drops code and links, keeps the words', () => {
    const text = speakable(
      '# Done\n\nI added `foo` to [the router](http://x.dev).\n\n```ts\nconst a = 1;\n```\n\n- **fast**',
    );
    expect(text).toBe('Done I added foo to the router. fast');
  });
});
