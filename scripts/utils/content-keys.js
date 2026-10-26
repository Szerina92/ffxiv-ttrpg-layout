/**
 * Translation-safe name keys.
 *
 * FFXIV TTRPG 5.4.0 compares content by a normalized key of the *original*
 * (untranslated) name, because Babele can translate names and text fields.
 * This is a small local copy of that logic, so the Layout does not depend on
 * a private system file. It reads the same Babele flag
 * (`flags.babele.sourceText`) the system reads.
 */

export function normalizeContentKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

/** The original (untranslated) text of a field, when Babele has translated it. */
export function getSourceText(document, field) {
  const value = field === "name" ? document?.name : document?.system?.[field];
  const source = document?.flags?.babele?.sourceText?.[field];
  if (source && value === source.translated) return source.original;
  return value;
}

/** Keys for the original and the displayed name of a document. */
export function getContentKeys(document) {
  return [...new Set([
    normalizeContentKey(getSourceText(document, "name")),
    normalizeContentKey(document?.name),
  ].filter(Boolean))];
}

/** Keys a document's `system.combo` text can refer to (original and displayed). */
export function getComboKeys(document) {
  return [...new Set([
    normalizeContentKey(getSourceText(document, "combo")),
    normalizeContentKey(document?.system?.combo),
  ].filter(Boolean))];
}
