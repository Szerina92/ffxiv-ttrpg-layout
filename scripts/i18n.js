/** FFXIV TTRPG Layout — shared localization helpers. */

export function localize(key, fallback = "", data = undefined) {
  if (!key || typeof game === "undefined" || typeof game?.i18n?.localize !== "function") {
    return fallback;
  }

  const localized = data === undefined
    ? game.i18n.localize(key)
    : game.i18n.localize(key, data);

  return localized && localized !== key ? localized : fallback;
}

function tagLeaf(tag) {
  const normalized = String(tag ?? "").trim();
  if (!normalized) return "";
  return normalized.split(".").pop() || normalized;
}

function tagFallbackLabel(tag) {
  const leaf = tagLeaf(tag);
  if (!leaf) return "";
  return leaf
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
}

/**
 * Localize any FFXIV tag without maintaining a hardcoded tag whitelist.
 * The system key is preferred; module-specific wording is used when the
 * module has a matching Tag.* or Item.* localization entry.
 */
export function localizeTag(tag) {
  const normalized = String(tag ?? "").trim();
  if (!normalized) return "";

  const leaf = tagLeaf(normalized);
  const candidates = [
    normalized,
    leaf ? `FFXIVTTRPGLayout.Tag.${leaf}` : "",
    leaf ? `FFXIVTTRPGLayout.Item.${leaf}` : "",
  ].filter(Boolean);

  for (const key of candidates) {
    const value = localize(key, "");
    if (value) return value;
  }

  return tagFallbackLabel(normalized);
}

/** Return every supplied tag, in source order, with no whitelist/filter. */
export function localizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map(localizeTag)
    .filter(Boolean);
}

