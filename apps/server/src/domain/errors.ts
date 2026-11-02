export type ErrorKind = 'not-found' | 'invalid' | 'forbidden' | 'conflict' | 'unavailable';

const STATUS: Record<ErrorKind, number> = {
  'not-found': 404,
  invalid: 400,
  forbidden: 403,
  conflict: 409,
  unavailable: 503,
};

export class DeckError extends Error {
  readonly kind: ErrorKind;

  constructor(kind: ErrorKind, message: string) {
    super(message);
    this.name = 'DeckError';
    this.kind = kind;
  }

  get httpStatus(): number {
    return STATUS[this.kind];
  }
}

export const notFound = (what: string): DeckError =>
  new DeckError('not-found', `${what} not found`);
export const invalid = (message: string): DeckError => new DeckError('invalid', message);
export const forbidden = (message: string): DeckError => new DeckError('forbidden', message);
export const conflict = (message: string): DeckError => new DeckError('conflict', message);
