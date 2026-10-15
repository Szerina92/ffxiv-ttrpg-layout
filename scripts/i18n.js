/** FFXIV TTRPG Layout — shared localization helpers. */

/**
 * Localize a module key. With `data`, placeholders such as `{size}` are filled in.
 * Module strings always exist in lang/en.json, which Foundry uses as fallback.
 */
export function localize(key, data) {
  return data === undefined ? game.i18n.localize(key) : game.i18n.format(key, data);
}

/**
 * Localize a key that may not exist (for example a key owned by the game
 * system) and return `fallback` when it is missing.
 */
export function localizeOr(key, fallback = "") {
  return key && game.i18n.has(key) ? game.i18n.localize(key) : fallback;
}

function tagLeaf(tag) {
  return tag.split(".").pop() || tag;
}

function tagFallbackLabel(tag) {
  return tagLeaf(tag)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
}

/**
 * Localize any FFXIV tag without maintaining a hardcoded tag whitelist.
 * The system key is preferred; module-specific wording is used when the
 * module has a matching Tag.* or Item.* localization entry.
 */
function localizeTag(tag) {
  const normalized = String(tag ?? "").trim();
  if (!normalized) return "";

  const leaf = tagLeaf(normalized);
  const candidates = [
    normalized,
    `FFXIVTTRPGLayout.Tag.${leaf}`,
    `FFXIVTTRPGLayout.Item.${leaf}`,
  ];

  for (const key of candidates) {
    if (game.i18n.has(key)) return game.i18n.localize(key);
  }

  return tagFallbackLabel(normalized);
}

/** Return every supplied tag, in source order, with no whitelist/filter. */
export function localizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.map(localizeTag).filter(Boolean);
}
