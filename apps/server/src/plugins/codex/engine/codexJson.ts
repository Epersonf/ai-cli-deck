export type Json = Record<string, unknown>;

export const obj = (value: unknown): Json | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : null;
export const str = (value: unknown): string => (typeof value === 'string' ? value : '');
