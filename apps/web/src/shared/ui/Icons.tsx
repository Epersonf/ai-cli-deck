interface Props {
  size?: number;
}

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 8,
  strokeLinecap: 'round',
} as const;

/** Three brass bars, the "all terminals" menu. */
export function MenuIcon({ size = 22 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden {...base}>
      <path d="M16 28h68M16 50h68M16 72h68" />
    </svg>
  );
}

/** A pencil, used to rename. */
export function PencilIcon({ size = 18 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
      {...base}
      strokeLinejoin="round"
    >
      <path d="M68 16l16 16-46 46-22 6 6-22Z" />
      <path d="M58 26l16 16" />
    </svg>
  );
}

/** A plus, used to add a terminal. */
export function PlusIcon({ size = 18 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden {...base}>
      <path d="M50 18v64M18 50h64" />
    </svg>
  );
}

/** A bin, used to delete a profile. */
export function TrashIcon({ size = 18 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
      {...base}
      strokeLinejoin="round"
    >
      <path d="M20 28h60M40 28V16h20v12M28 28l5 56h34l5-56M44 44v28M56 44v28" />
    </svg>
  );
}

/** A circular arrow, used to refresh. */
export function RefreshIcon({ size = 18 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
      {...base}
      strokeLinejoin="round"
    >
      <path d="M80 50a30 30 0 1 1-9-21.5" />
      <path d="M74 12v20H54" />
    </svg>
  );
}

/** Up and down arrows, used for upload / download. */
export function TransferIcon({ size = 18 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
      {...base}
      strokeLinejoin="round"
    >
      <path d="M34 82V20M18 36l16-16 16 16M66 18v62M50 64l16 16 16-16" />
    </svg>
  );
}

/** Three sliders, used for the explorer options. */
export function SlidersIcon({ size = 18 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden {...base}>
      <path d="M14 26h72M14 50h72M14 74h72" />
      <circle cx="34" cy="26" r="9" fill="var(--leather-2)" />
      <circle cx="66" cy="50" r="9" fill="var(--leather-2)" />
      <circle cx="42" cy="74" r="9" fill="var(--leather-2)" />
    </svg>
  );
}

/** A prompt in a window, used to open a terminal in a folder. */
export function TerminalIcon({ size = 18 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
      {...base}
      strokeLinejoin="round"
    >
      <rect x="12" y="20" width="76" height="60" rx="8" />
      <path d="M28 40l14 10-14 10M50 64h22" />
    </svg>
  );
}

/** A magnifier: find text in the terminal. */
export function SearchIcon({ size = 20 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden {...base}>
      <circle cx="42" cy="42" r="26" />
      <path d="M62 62l22 22" />
    </svg>
  );
}
