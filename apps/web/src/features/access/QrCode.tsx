import { useMemo } from 'react';
import { qrPath } from './otpFormat';

/** A scannable QR code as inline SVG: dark ink on parchment, with the quiet zone a scanner needs. */
export function QrCode({ text, label }: { text: string; label: string }) {
  const { size, d } = useMemo(() => qrPath(text), [text]);
  return (
    <svg
      className="qr"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#f3e6c6" />
      <path d={d} fill="#1b1008" />
    </svg>
  );
}
