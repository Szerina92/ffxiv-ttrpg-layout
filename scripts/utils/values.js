/** FFXIV TTRPG Layout — small value-normalization helpers. */

/** Trimmed string; null and undefined become an empty string. */
export function text(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/** Finite number, or `fallback` when the value is not numeric. */
export function numberOr(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
