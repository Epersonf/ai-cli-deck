import { z } from 'zod';

export const MIN_RATIO = 0.25;
export const MAX_RATIO = 0.8;
const DEFAULT_RATIO = 0.58;

export const clampRatio = (ratio: number): number =>
  Number.isFinite(ratio) ? Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio)) : DEFAULT_RATIO;

const LayoutSchema = z.object({
  showRight: z.boolean().catch(true),
  rightView: z.enum(['files', 'preview']).catch('files'),
  ratio: z.number().catch(DEFAULT_RATIO).transform(clampRatio),
});

export type LayoutPref = z.infer<typeof LayoutSchema>;
export type RightView = LayoutPref['rightView'];
export const DEFAULT_LAYOUT: LayoutPref = {
  showRight: true,
  rightView: 'files',
  ratio: DEFAULT_RATIO,
};

/** Stored layout, repaired field by field; anything unreadable falls back to the defaults. */
export function parseLayout(text: string | null): LayoutPref {
  try {
    const parsed = LayoutSchema.safeParse(JSON.parse(text ?? 'null'));
    return parsed.success ? parsed.data : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

const KEY = 'deck-layout';

export function loadLayout(): LayoutPref {
  try {
    return parseLayout(localStorage.getItem(KEY));
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function saveLayout(layout: LayoutPref): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(layout));
  } catch {
    // layout only lasts for this page load
  }
}
