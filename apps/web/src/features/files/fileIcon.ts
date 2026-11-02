import { mediaKindOf } from '@deck/shared';

const ICONS = { image: '🖼', audio: '🎵', video: '🎬', pdf: '📕', text: '📄' } as const;

export const iconFor = (name: string, kind: 'file' | 'dir'): string =>
  kind === 'dir' ? '📁' : ICONS[mediaKindOf(name)];
