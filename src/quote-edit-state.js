// JSONB can reorder object keys; metadata updates do not represent an edit.
export function quoteFingerprint(quote) {
  function ordered(value, root = false) {
    if (Array.isArray(value)) return value.map((item) => ordered(item));
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.keys(value)
          .filter((key) => !(root && key === "updatedAt"))
          .sort()
          .map((key) => [key, ordered(value[key])]),
      );
    return value;
  }
  return JSON.stringify(ordered(quote, true));
}
