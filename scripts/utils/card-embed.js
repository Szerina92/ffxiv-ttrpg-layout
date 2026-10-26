/** FFXIV TTRPG Layout — shared option handling for card embeds (Ability, Trait). */

import { normalizePosition } from "./enricher-options.js";

/**
 * `half` halves the width (like a Class Summary column); left/right/center
 * place it. Without `half` the card keeps the full width.
 *
 * @param {HTMLElement} root
 * @param {string[]} options
 */
export function applyCardEmbedOptions(root, options = []) {
  root.classList.add("ffxiv-card-embed");
  const lowered = options.map(option => String(option).toLowerCase());
  if (lowered.includes("half")) root.classList.add("ffxiv-card-embed--half");
  const position = ["left", "right", "center"].find(name => lowered.includes(name));
  if (position) root.classList.add(`ffxiv-card-embed--float-${normalizePosition(position)}`);
}
