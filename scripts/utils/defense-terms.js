/**
 * "Defense" / "Magic Defense" in a CR value.
 *
 * CR text can be translated (Babele or the system's own French), so the terms
 * are the English ones plus the system's localized ones. Longest first, so
 * "Magic Defense" is not cut at "Defense".
 */

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function defenseTerms() {
  const localized = ["FFXIV.Attributes.MagicDefense", "FFXIV.Attributes.Defense"]
    .map(key => game.i18n.localize(key))
    .filter(value => value && !value.startsWith("FFXIV."));
  return [...new Set(["Magic Defense", "Defense", ...localized])]
    .sort((a, b) => b.length - a.length);
}

/**
 * A new global RegExp matching any of the terms (new instance: `lastIndex` is
 * stateful). With `capture`, the match is a group, for `String.split`.
 */
export function defensePattern({ capture = false } = {}) {
  const source = defenseTerms().map(escapeRegExp).join("|");
  return new RegExp(capture ? `(${source})` : source, "g");
}
