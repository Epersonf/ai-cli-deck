interface Props {
  size?: number;
  teeth?: number;
  className?: string;
}

/** Closed outline of a gear: alternating outer/inner radius points around the centre. */
export function gearPoints(teeth: number, outer: number, inner: number): string {
  const points: string[] = [];
  const step = (Math.PI * 2) / (teeth * 4);
  for (let i = 0; i < teeth * 4; i += 1) {
    const radius = i % 4 === 0 || i % 4 === 1 ? outer : inner;
    const x = (50 + radius * Math.cos(i * step)).toFixed(2);
    const y = (50 + radius * Math.sin(i * step)).toFixed(2);
    points.push(`${x},${y}`);
  }
  return points.join(' ');
}

export function Gear({ size = 28, teeth = 10, className = '' }: Props) {
  return (
    <svg
      className={`gear ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
    >
      <polygon points={gearPoints(teeth, 48, 38)} fill="currentColor" />
      <circle cx="50" cy="50" r="22" fill="var(--ink)" />
      <circle cx="50" cy="50" r="9" fill="currentColor" />
    </svg>
  );
}
