import { describe, expect, it } from 'vitest';
import { extensionOf, mediaKindOf, mimeOf } from './media.js';

describe('media helpers', () => {
  it('classifies images, audio, video and pdf by extension', () => {
    expect(mediaKindOf('a/b/photo.PNG')).toBe('image');
    expect(mediaKindOf('song.mp3')).toBe('audio');
    expect(mediaKindOf('clip.webm')).toBe('video');
    expect(mediaKindOf('doc.pdf')).toBe('pdf');
    expect(mediaKindOf('src/main.ts')).toBe('text');
  });

  it('returns mime types only for known media', () => {
    expect(mimeOf('x.svg')).toBe('image/svg+xml');
    expect(mimeOf('x.m4a')).toBe('audio/mp4');
    expect(mimeOf('x.unknown')).toBeNull();
  });

  it('handles dotfiles and missing extensions', () => {
    expect(extensionOf('.gitignore')).toBe('');
    expect(extensionOf('Makefile')).toBe('');
    expect(extensionOf('dir.v2/file')).toBe('');
  });
});
