/**
 * JSON with comments: `//` and block comments, and trailing commas, are allowed. Anything inside a string
 * is left alone. Used for profile templates, where the comments are the documentation.
 */
export function stripJsonc(text: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    const next = text.charAt(i + 1);
    if (inString) {
      out += char;
      if (char === '\\') out += text.charAt(++i);
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
      out += char;
    } else if (char === '/' && next === '/') {
      while (i < text.length && text.charAt(i) !== '\n') i += 1;
      out += '\n';
    } else if (char === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end < 0 ? text.length : end + 1;
    } else {
      out += char;
    }
  }
  return removeTrailingCommas(out);
}

function removeTrailingCommas(text: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    if (inString) {
      out += char;
      if (char === '\\') out += text.charAt(++i);
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
      out += char;
    } else if (char === ',' && /^\s*[}\]]/.test(text.slice(i + 1))) {
      // a comma right before a closing bracket: drop it
    } else {
      out += char;
    }
  }
  return out;
}

/** Parses JSON with comments; throws a SyntaxError (with the position) when it is not valid. */
export const parseJsonc = (text: string): unknown =>
  JSON.parse(stripJsonc(text.startsWith('\uFEFF') ? text.slice(1) : text));
