import type { ReactNode } from 'react';

export interface Props {
  size?: number | undefined;
}

export const Svg = ({ size = 18, children }: Props & { children: ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    aria-hidden
    fill="none"
    stroke="currentColor"
    strokeWidth={7}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

/** A pushpin: pinned (pressed) or not. */
export const PinIcon = ({ size, pinned = false }: Props & { pinned?: boolean }) => (
  <Svg size={size}>
    <path
      d="M36 14h28l-4 24 14 14v8H26v-8l14-14Z"
      fill={pinned ? 'currentColor' : 'none'}
      fillOpacity={0.45}
    />
    <path d="M50 60v28" />
  </Svg>
);

/** A house: back to the session's base folder. */
export const HomeIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M14 48 50 16l36 32" />
    <path d="M24 42v40h20V60h12v22h20V42" />
  </Svg>
);

/** A branch that splits: a side chat. */
export const ForkIcon = (p: Props) => (
  <Svg {...p}>
    <circle cx="28" cy="22" r="9" />
    <circle cx="72" cy="22" r="9" />
    <circle cx="50" cy="80" r="9" />
    <path d="M28 31v10a10 10 0 0 0 10 10h24a10 10 0 0 0 10-10V31M50 51v20" />
  </Svg>
);

/** A microphone. */
export const MicIcon = (p: Props) => (
  <Svg {...p}>
    <rect x="38" y="12" width="24" height="44" rx="12" />
    <path d="M24 46a26 26 0 0 0 52 0M50 72v16M36 88h28" />
  </Svg>
);

/** An arrow turning back: undo or discard. */
export const UndoIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M30 20L14 36l16 16" />
    <path d="M14 36h44a26 26 0 0 1 0 52H34" />
  </Svg>
);

/** An arrow into a tray: download. */
export const DownloadIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M50 14v50M30 46l20 20 20-20M16 86h68" />
  </Svg>
);

/** An arrow out of a tray: upload. */
export const UploadIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M50 66V16M30 34l20-20 20 20M16 86h68" />
  </Svg>
);

/** An arrow leaving a square: open in a new page. */
export const ExternalIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M44 22H22a8 8 0 0 0-8 8v48a8 8 0 0 0 8 8h48a8 8 0 0 0 8-8V56" />
    <path d="M60 14h26v26M86 14L48 52" />
  </Svg>
);

/** A triangle with a bar: a warning. */
export const WarnIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M50 14L90 84H10Z" />
    <path d="M50 42v20M50 72v2" />
  </Svg>
);

/** An arrow bent down and left: enter. */
export const EnterIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M84 20v30a10 10 0 0 1-10 10H18M36 42L18 60l18 18" />
  </Svg>
);

/** Two arrows opposite ways: a remote deck. */
export const RemoteIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M14 34h64M62 18l16 16-16 16M86 68H22M38 52L22 68l16 16" />
  </Svg>
);
