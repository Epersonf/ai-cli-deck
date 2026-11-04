import { describe, expect, it } from 'vitest';
import { osc52Text } from './clipboardOsc';

const b64 = (text: string): string => btoa(String.fromCharCode(...new TextEncoder().encode(text)));

describe('osc52Text', () => {
  it('decodes what a program copied, including non-ASCII', () => {
    expect(osc52Text(`c;${b64('git status')}`)).toBe('git status');
    expect(osc52Text(`;${b64('olá ✓')}`)).toBe('olá ✓');
  });

  it('ignores queries, clears and garbage', () => {
    expect(osc52Text('c;?')).toBeNull();
    expect(osc52Text('c;')).toBeNull();
    expect(osc52Text('c;%%%')).toBeNull();
  });
});
