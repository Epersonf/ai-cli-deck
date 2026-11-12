import type { ImageInput } from '@deck/shared';

/** What can go with a message: pictures and PDFs, which the agents read. */
export const ACCEPT = 'image/*,application/pdf';
/** Biggest file taken (base64 makes it a third bigger on the wire; the socket allows ~14 MB of text). */
export const MAX_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 10;

export const isAttachable = (file: { type: string }): boolean =>
  file.type.startsWith('image/') || file.type === 'application/pdf';

/** The attachable files among `files` (a pasted or dropped list also holds text and folders). */
export const attachable = (files: Iterable<File>): File[] => [...files].filter(isAttachable);

export type ReadResult = { ok: true; image: ImageInput } | { ok: false; name: string; why: 'size' };

/** A file as base64 for the socket; refuses what is too big. */
export function readAttachment(file: File): Promise<ReadResult> {
  if (file.size > MAX_BYTES) return Promise.resolve({ ok: false, name: file.name, why: 'size' });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : '';
      const data = url.slice(url.indexOf(',') + 1);
      const name = file.name === '' ? undefined : file.name;
      resolve({ ok: true, image: { mediaType: file.type, data, ...(name ? { name } : {}) } });
    };
    reader.readAsDataURL(file);
  });
}
