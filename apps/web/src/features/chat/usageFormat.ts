import type { ChatUsage } from '@deck/shared';

/** 12_345 → "12.3k", 1_200_000 → "1.2M". */
export function tokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 100_000 ? 0 : 1)}k`;
  return String(count);
}

/** Fraction of the model's window the conversation fills, 0..1; null when either number is unknown. */
export function contextFill(usage: ChatUsage): number | null {
  const { contextTokens, contextWindow } = usage;
  if (contextTokens === null || contextWindow === null || contextWindow <= 0) return null;
  return Math.min(1, contextTokens / contextWindow);
}

export const percent = (fraction: number): string => `${Math.round(fraction * 100)}%`;

/** "2h 10m", "35m", "now": how long until `iso`. */
export function untilReset(iso: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((Date.parse(iso) - now) / 60_000));
  if (Number.isNaN(minutes) || minutes === 0) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours >= 48) return `${Math.floor(hours / 24)}d`;
  return `${hours}h ${minutes % 60}m`;
}

export const cost = (usd: number): string => `$${usd.toFixed(usd < 0.1 ? 4 : 2)}`;

/** The gauge's colour band: calm, getting full, nearly out. */
export const band = (fraction: number): 'ok' | 'warn' | 'full' =>
  fraction >= 0.9 ? 'full' : fraction >= 0.7 ? 'warn' : 'ok';
