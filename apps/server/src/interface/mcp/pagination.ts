/** MCP responses carry continuation offsets so savings happen before the result reaches the model. */
export function pageItems<T>(items: readonly T[], offset: number, limit: number) {
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    nextOffset: offset + limit < items.length ? offset + limit : null,
  };
}

/** UTF-16 offsets, like JS string indexes. Never split a surrogate pair across pages. */
export function pageText(text: string, offset: number, limit: number) {
  let start = Math.min(offset, text.length);
  if (start > 0 && /[\uDC00-\uDFFF]/.test(text[start] ?? '')) start -= 1;
  let end = Math.min(text.length, start + limit);
  if (end < text.length && /[\uDC00-\uDFFF]/.test(text[end] ?? '')) end -= 1;
  return {
    text: text.slice(start, end),
    offset: start,
    total: text.length,
    nextOffset: end < text.length ? end : null,
  };
}
