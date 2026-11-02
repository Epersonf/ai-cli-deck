export type MediaKind = 'image' | 'audio' | 'video' | 'pdf' | 'text';

const MIME: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  ogv: 'video/ogg',
  pdf: 'application/pdf',
};

export function extensionOf(path: string): string {
  const name = path.split('/').pop() ?? '';
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase();
}

/** MIME type for files the viewer can play or show natively; null for everything else. */
export function mimeOf(path: string): string | null {
  return MIME[extensionOf(path)] ?? null;
}

export function mediaKindOf(path: string): MediaKind {
  const mime = mimeOf(path);
  if (mime === null) return 'text';
  if (mime === 'application/pdf') return 'pdf';
  return mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'audio' : 'video';
}
