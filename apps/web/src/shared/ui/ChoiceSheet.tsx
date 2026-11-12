import { useState } from 'react';
import { useT } from '../i18n/store';
import { ChevronIcon } from './ShapeIcons';

export interface Choice {
  id: string;
  title: string;
  subtitle: string;
}

interface Props {
  label: string;
  value: string;
  choices: readonly Choice[];
  onChange(id: string): void;
}

/** A select-style control: the current choice with its subtitle; opens a sheet of choices (a bottom sheet on a phone). */
export function ChoiceSheet({ label, value, choices, onChange }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const current = choices.find((c) => c.id === value) ?? choices[0];
  if (choices.length < 2) return null;
  return (
    <div className="field-row">
      {label}
      <button
        type="button"
        className="choice-btn"
        aria-haspopup="listbox"
        onClick={() => setOpen(true)}
      >
        <span className="choice-text">
          <strong>{current?.title}</strong>
          <small>{current?.subtitle}</small>
        </span>
        <ChevronIcon size={16} open />
      </button>
      {open && (
        <div className="modal-backdrop confirm-backdrop sheet" onClick={() => setOpen(false)}>
          <div
            className="modal choice-sheet"
            role="listbox"
            aria-label={label}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{label}</h2>
            {choices.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={c.id === value}
                className={`choice-option${c.id === value ? ' on' : ''}`}
                onClick={() => (onChange(c.id), setOpen(false))}
              >
                <strong>{c.title}</strong>
                <small>{c.subtitle}</small>
              </button>
            ))}
            <button type="button" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
