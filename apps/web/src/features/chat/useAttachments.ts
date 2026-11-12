import type { ImageInput } from '@deck/shared';
import { useCallback, useState } from 'react';
import { MAX_FILES, attachable, readAttachment } from './attachFiles';

/** The pictures and PDFs waiting to go with the next message. */
export function useAttachments() {
  const [items, setItems] = useState<ImageInput[]>([]);
  const [tooBig, setTooBig] = useState<string | null>(null);

  const add = useCallback(async (files: Iterable<File>): Promise<void> => {
    setTooBig(null);
    for (const file of attachable(files)) {
      try {
        const result = await readAttachment(file);
        if (!result.ok) setTooBig(result.name);
        else setItems((list) => (list.length < MAX_FILES ? [...list, result.image] : list));
      } catch {
        setTooBig(file.name);
      }
    }
  }, []);

  const remove = useCallback((index: number): void => {
    setItems((list) => list.filter((_, i) => i !== index));
  }, []);
  const clear = useCallback((): void => (setItems([]), setTooBig(null)), []);

  return { items, tooBig, add, remove, clear };
}

export const previewUrl = (image: ImageInput): string | null =>
  image.mediaType.startsWith('image/') ? `data:${image.mediaType};base64,${image.data}` : null;
