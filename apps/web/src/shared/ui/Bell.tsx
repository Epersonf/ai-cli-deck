interface Props {
  size?: number;
}

/** Brass service bell drawn as SVG so it matches the steampunk theme (no emoji). */
export function Bell({ size = 22 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden fill="none">
      <circle cx="50" cy="12" r="6" fill="currentColor" />
      <path
        d="M50 18C32 18 24 32 24 50v14L14 76h72L76 64V50C76 32 68 18 50 18Z"
        fill="currentColor"
        stroke="var(--ink)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M30 40c2-9 8-15 16-17" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
      <path d="M38 80a12 12 0 0 0 24 0Z" fill="currentColor" />
    </svg>
  );
}
