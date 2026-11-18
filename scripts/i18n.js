/* Localization helpers */

export function localize(key, data) {
  return data === undefined ? game.i18n.localize(key) : game.i18n.format(key, data);
}

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

export function localizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  return tags.map(localizeTag).filter(label => {
    const key = String(label ?? "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
