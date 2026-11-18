/* Value helpers */

export function text(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function numberOr(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function escapeHTML(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}
