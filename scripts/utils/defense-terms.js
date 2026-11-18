/* Defense terms */

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function defenseTerms() {
  const localized = ["FFXIV.Attributes.MagicDefense", "FFXIV.Attributes.Defense"]
    .map(key => game.i18n.localize(key))
    .filter(value => value && !value.startsWith("FFXIV."));
  return [...new Set(["Magic Defense", "Defense", ...localized])]
    .sort((a, b) => b.length - a.length);
}

export function defensePattern({ capture = false } = {}) {
  const source = defenseTerms().map(escapeRegExp).join("|");
  return new RegExp(capture ? `(${source})` : source, "g");
}
