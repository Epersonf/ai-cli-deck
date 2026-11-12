import { describe, expect, it } from 'vitest';
import {
  backspace,
  emptyBoxes,
  isComplete,
  joinBoxes,
  moveFocus,
  pasteDigits,
  toBoxes,
  typeDigit,
} from './boxEdits';

describe('digit boxes', () => {
  it('keeps one digit and advances', () => {
    const edit = typeDigit(emptyBoxes(), 0, '7');
    expect(joinBoxes(edit.boxes)).toBe('7');
    expect(edit.focus).toBe(1);
  });

  it('ignores letters and stays put', () => {
    const edit = typeDigit(emptyBoxes(), 2, 'a');
    expect(joinBoxes(edit.boxes)).toBe('');
    expect(edit.focus).toBe(2);
  });

  it('takes the last digit when a filled box gets another', () => {
    expect(typeDigit(toBoxes('1'), 0, '12').boxes[0]).toBe('2');
  });

  it('does not run past the last box', () => {
    expect(typeDigit(emptyBoxes(), 5, '9').focus).toBe(5);
  });

  it('pastes six digits at once, even with a space and from a middle box', () => {
    const edit = pasteDigits(toBoxes('99'), 3, '123 456');
    expect(joinBoxes(edit.boxes)).toBe('123456');
    expect(isComplete(edit.boxes)).toBe(true);
    expect(edit.focus).toBe(5);
  });

  it('pastes a short code from the focused box', () => {
    const edit = pasteDigits(emptyBoxes(), 1, '45');
    expect(edit.boxes).toEqual(['', '4', '5', '', '', '']);
    expect(edit.focus).toBe(3);
  });

  it('ignores a paste with no digits', () => {
    expect(joinBoxes(pasteDigits(toBoxes('12'), 2, 'abc').boxes)).toBe('12');
  });

  it('backspace clears the box, then steps back', () => {
    const first = backspace(toBoxes('12'), 1);
    expect(first.boxes).toEqual(['1', '', '', '', '', '']);
    expect(first.focus).toBe(1);
    const second = backspace(first.boxes, 1);
    expect(second.boxes).toEqual(['', '', '', '', '', '']);
    expect(second.focus).toBe(0);
  });

  it('arrows stay inside the row', () => {
    expect(moveFocus(0, 'ArrowLeft')).toBe(0);
    expect(moveFocus(5, 'ArrowRight')).toBe(5);
    expect(moveFocus(2, 'ArrowRight')).toBe(3);
  });
});
