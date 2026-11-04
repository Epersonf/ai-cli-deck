/* eslint-disable no-control-regex -- matching terminal escape characters is the point of this file */
// Terminal control sequences: CSI (colors, cursor), OSC (window title), and charset selections.
const CONTROL = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[()][A-Z0-9]/g;

/** Text without terminal control sequences, for showing a command's output as plain text. */
export const stripAnsi = (text: string): string => text.replace(CONTROL, '');
