/* Card embed options */

import { normalizePosition } from "./enricher-options.js";

export function applyCardEmbedOptions(root, options = []) {
  root.classList.add("ffxiv-card-embed");
  const lowered = options.map(option => String(option).toLowerCase());
  if (lowered.includes("half")) root.classList.add("ffxiv-card-embed--half");
  const position = ["left", "right", "center"].find(name => lowered.includes(name));
  if (position) root.classList.add(`ffxiv-card-embed--float-${normalizePosition(position)}`);
}
