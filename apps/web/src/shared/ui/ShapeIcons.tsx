import { Svg, type Props } from './GlyphIcons';

/** A folder. */
export const FolderIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M12 26a8 8 0 0 1 8-8h22l10 12h28a8 8 0 0 1 8 8v36a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8Z" />
  </Svg>
);

/** A page with lines: a text file (the base of the other file kinds). */
export const FileIcon = ({ size, kind = 'text' }: Props & { kind?: FileKind }) => (
  <Svg size={size}>
    <path d="M28 12h30l20 20v50a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6Z" />
    <path d="M58 12v20h20" />
    {kind === 'text' && <path d="M34 52h32M34 68h24" />}
    {kind === 'image' && <path d="M32 78l14-18 10 12 8-8 10 14" />}
    {kind === 'audio' && <path d="M44 74V50l18-4v22M44 74a6 6 0 1 1-6-6M62 68a6 6 0 1 1-6-6" />}
    {kind === 'video' && <path d="M40 50l22 12-22 12Z" />}
    {kind === 'pdf' && <path d="M34 56h32M34 68h32" />}
  </Svg>
);
export type FileKind = 'text' | 'image' | 'audio' | 'video' | 'pdf';

/** A shallow chevron; `open` turns it to point down. */
export const ChevronIcon = ({ size, open = false }: Props & { open?: boolean }) => (
  <Svg size={size}>
    <path d={open ? 'M22 36l28 28 28-28' : 'M36 22l28 28-28 28'} />
  </Svg>
);

/** A dot: something changed inside. */
export const DotIcon = (p: Props) => (
  <Svg {...p}>
    <circle cx="50" cy="50" r="16" fill="currentColor" />
  </Svg>
);

/** A cog on a wrench's handle: a tool of no known kind. */
export const WrenchIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M70 18a18 18 0 0 0-17 24L16 79a8 8 0 0 0 11 11l37-37a18 18 0 0 0 24-17l-12 12-12-4-4-12Z" />
  </Svg>
);

/** A globe: the web. */
export const GlobeIcon = (p: Props) => (
  <Svg {...p}>
    <circle cx="50" cy="50" r="36" />
    <path d="M14 50h72M50 14c-18 20-18 52 0 72M50 14c18 20 18 52 0 72" />
  </Svg>
);

/** A bulleted list. */
export const ListIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M36 28h50M36 50h50M36 72h50M16 28h2M16 50h2M16 72h2" />
  </Svg>
);

/** A tick: a finished step. */
export const CheckIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M20 54l20 20 42-46" />
  </Svg>
);

/** An eye: show what is typed. */
export const EyeIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M8 50C22 28 38 20 50 20s28 8 42 30C78 72 62 80 50 80S22 72 8 50Z" />
    <circle cx="50" cy="50" r="13" />
  </Svg>
);

/** A crossed eye: hide what is typed. */
export const EyeOffIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M8 50C22 28 38 20 50 20s28 8 42 30C78 72 62 80 50 80S22 72 8 50Z" />
    <path d="M18 84L82 16" />
  </Svg>
);
