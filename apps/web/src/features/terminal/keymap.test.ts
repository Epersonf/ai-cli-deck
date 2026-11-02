import { describe, expect, it } from 'vitest';
import { NO_MODS, applyModifiersToText, controlChar, sequenceFor } from './keymap';

const normal = { applicationCursor: false };
const app = { applicationCursor: true };

describe('sequenceFor', () => {
  it('maps plain special keys to escape sequences', () => {
    expect(sequenceFor('ESC', NO_MODS, normal)).toBe('\x1b');
    expect(sequenceFor('TAB', NO_MODS, normal)).toBe('\t');
    expect(sequenceFor('UP', NO_MODS, normal)).toBe('\x1b[A');
    expect(sequenceFor('HOME', NO_MODS, normal)).toBe('\x1b[H');
    expect(sequenceFor('END', NO_MODS, normal)).toBe('\x1b[F');
    expect(sequenceFor('PGUP', NO_MODS, normal)).toBe('\x1b[5~');
    expect(sequenceFor('PGDN', NO_MODS, normal)).toBe('\x1b[6~');
  });

  it('uses SS3 sequences in application cursor mode', () => {
    expect(sequenceFor('LEFT', NO_MODS, app)).toBe('\x1bOD');
    expect(sequenceFor('HOME', NO_MODS, app)).toBe('\x1bOH');
  });

  it('encodes modifiers on cursor and paging keys', () => {
    expect(sequenceFor('RIGHT', { ctrl: true, alt: false }, normal)).toBe('\x1b[1;5C');
    expect(sequenceFor('LEFT', { ctrl: false, alt: true }, app)).toBe('\x1b[1;3D');
    expect(sequenceFor('PGUP', { ctrl: true, alt: true }, normal)).toBe('\x1b[5;7~');
  });

  it('sends literal keys and applies modifiers to them', () => {
    expect(sequenceFor('/', NO_MODS, normal)).toBe('/');
    expect(sequenceFor('|', NO_MODS, normal)).toBe('|');
    expect(sequenceFor('-', { ctrl: false, alt: true }, normal)).toBe('\x1b-');
    expect(sequenceFor('TAB', { ctrl: false, alt: true }, normal)).toBe('\x1b\t');
  });
});

describe('applyModifiersToText', () => {
  it('turns CTRL+letter into control codes', () => {
    expect(applyModifiersToText('c', { ctrl: true, alt: false })).toBe('\x03');
    expect(applyModifiersToText('D', { ctrl: true, alt: false })).toBe('\x04');
    expect(applyModifiersToText('[', { ctrl: true, alt: false })).toBe('\x1b');
  });

  it('prefixes ALT with ESC and combines with CTRL', () => {
    expect(applyModifiersToText('b', { ctrl: false, alt: true })).toBe('\x1bb');
    expect(applyModifiersToText('c', { ctrl: true, alt: true })).toBe('\x1b\x03');
  });

  it('leaves pastes, sequences and unmodified input untouched', () => {
    expect(applyModifiersToText('hello', { ctrl: true, alt: true })).toBe('hello');
    expect(applyModifiersToText('\x1b[A', { ctrl: true, alt: false })).toBe('\x1b[A');
    expect(applyModifiersToText('c', NO_MODS)).toBe('c');
    expect(controlChar('1')).toBeNull();
  });
});
