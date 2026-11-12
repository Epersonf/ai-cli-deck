import type { ReactNode } from 'react';

/** The footer of a dialog: one layout everywhere (primary at the right, equal columns on a phone). */
export function DialogActions({ children }: { children: ReactNode }) {
  return <div className="dialog-actions">{children}</div>;
}

/** A label over one control, with an optional hint under it. */
export function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field-row">
      {label}
      {children}
      {hint !== undefined && <span className="hint">{hint}</span>}
    </label>
  );
}

/** A control and its button on one row, the same height. */
export function InlineField({ children }: { children: ReactNode }) {
  return <div className="field-inline">{children}</div>;
}

/** A collapsed "where do I find it?" block. */
export function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="disclosure">
      <summary>{summary}</summary>
      <div>{children}</div>
    </details>
  );
}
