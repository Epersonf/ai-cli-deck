import type { ImageInput } from '@deck/shared';
import { useT } from '../../shared/i18n/store';
import { previewUrl } from './useAttachments';
import { FileIcon } from '../../shared/ui/ShapeIcons';

interface Props {
  items: readonly ImageInput[];
  tooBig: string | null;
  onRemove(index: number): void;
}

/** What is attached to the message being written: thumbnails (or a PDF chip) with a remove button. */
export function Attachments({ items, tooBig, onRemove }: Props) {
  const t = useT();
  if (items.length === 0 && tooBig === null) return null;
  return (
    <div className="composer-files">
      {items.map((item, i) => {
        const src = previewUrl(item);
        return (
          <span key={i} className="composer-file">
            {src ? (
              <img src={src} alt={item.name ?? ''} />
            ) : (
              <span>
                <FileIcon size={14} kind="pdf" /> {item.name ?? 'PDF'}
              </span>
            )}
            <button
              type="button"
              aria-label={t('chat.removeFile')}
              title={t('chat.removeFile')}
              onClick={() => onRemove(i)}
            >
              ×
            </button>
          </span>
        );
      })}
      {tooBig !== null && (
        <span className="notice error">{t('chat.tooBig', { name: tooBig })}</span>
      )}
    </div>
  );
}
