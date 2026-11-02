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
