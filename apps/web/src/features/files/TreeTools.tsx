import type { ReactNode } from 'react';
import { useT } from '../../shared/i18n/store';
import {
  RefreshIcon,
  SlidersIcon,
  TerminalIcon,
  TransferIcon,
  TrashIcon,
} from '../../shared/ui/Icons';

interface ToolProps {
  tip: string;
  onClick(): void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}

/** Icon-only button; the name shows as a tooltip on hover/focus and is the accessible label. */
function Tool({ tip, onClick, disabled, danger, children }: ToolProps) {
  return (
    <button
      type="button"
      className={danger ? 'tool-btn danger' : 'tool-btn'}
      data-tip={tip}
      aria-label={tip}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

interface Props {
  busy: boolean;
  canDelete: boolean;
  onRefresh(): void;
  onTransfer(): void;
  onTerminal(): void;
  onOptions(): void;
  onDelete(): void;
}

/** The explorer toolbar: one joined group of icon buttons. */
export function TreeTools({
  busy,
  canDelete,
  onRefresh,
  onTransfer,
  onTerminal,
  onOptions,
  onDelete,
}: Props) {
  const t = useT();
  return (
    <div className="tree-tools">
      <div className="tool-group" role="toolbar">
        <Tool tip={t('common.refresh')} onClick={onRefresh}>
          <RefreshIcon />
        </Tool>
        <Tool tip={t('files.transfer')} onClick={onTransfer} disabled={busy}>
          <TransferIcon />
        </Tool>
        <Tool tip={t('files.openTerminal')} onClick={onTerminal}>
          <TerminalIcon />
        </Tool>
        <Tool tip={t('files.options')} onClick={onOptions}>
          <SlidersIcon />
        </Tool>
        <Tool tip={t('files.delete')} onClick={onDelete} disabled={!canDelete} danger>
          <TrashIcon />
        </Tool>
      </div>
    </div>
  );
}
