/* Content keys */

function normalizeContentKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

export function getSourceText(document, field) {
  const value = field === "name" ? document?.name : document?.system?.[field];
  const source = document?.flags?.babele?.sourceText?.[field];
  if (source && value === source.translated) return source.original;
  return value;
}

export function getContentKeys(document) {
  return [...new Set([
    normalizeContentKey(getSourceText(document, "name")),
    normalizeContentKey(document?.name),
  ].filter(Boolean))];
}

export function getComboKeys(document) {
  return [...new Set([
    normalizeContentKey(getSourceText(document, "combo")),
    normalizeContentKey(document?.system?.combo),
  ].filter(Boolean))];
}
