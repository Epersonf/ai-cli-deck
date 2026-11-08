import type { ReactNode } from 'react';

interface Props {
  size?: number;
}

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const Svg = ({ size = 22, children }: Props & { children: ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden {...base}>
    {children}
  </svg>
);

/** Two sheets: copy. */
export const CopyIcon = (p: Props) => (
  <Svg {...p}>
    <rect x="34" y="30" width="46" height="56" rx="7" />
    <path d="M62 30V20a7 7 0 0 0-7-7H25a7 7 0 0 0-7 7v46a7 7 0 0 0 7 7h9" />
  </Svg>
);

/** A clock with a counter-clockwise arrow: the whole history. */
export const HistoryIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M18 50a32 32 0 1 0 10-23" />
    <path d="M16 12v18h18M50 32v20l13 8" />
  </Svg>
);

/** A text cursor over lines: choose the text to copy. */
export const SelectIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M18 28h40M18 50h28M18 72h40" />
    <path d="M76 22v56M68 22h16M68 78h16" />
  </Svg>
);

/** A speaker with sound waves: listen. */
export const SpeakerIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M16 38h16l22-18v60L32 62H16z" />
    <path d="M68 36a20 20 0 0 1 0 28M78 24a36 36 0 0 1 0 52" />
  </Svg>
);

/** A square: stop. */
export const StopIcon = (p: Props) => (
  <Svg {...p}>
    <rect x="24" y="24" width="52" height="52" rx="8" />
  </Svg>
);

/** A plain X, to close a bar (not a button-looking control). */
export const CloseIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M24 24l52 52M76 24L24 76" />
  </Svg>
);

/** A chevron pointing up: the previous match. */
export const UpIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M24 62l26-26 26 26" />
  </Svg>
);

/** A chevron pointing down: the next match. */
export const DownIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M24 38l26 26 26-26" />
  </Svg>
);
